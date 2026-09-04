// Self-contained, offline Draft 2020-12 evaluator for the package's closed
// vocabulary. Unknown keywords fail compilation; no unimplemented keyword is
// silently ignored. It supports $ref, applicators and evaluated properties.
import assert from 'node:assert/strict';

export function parseStrict(text) {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] || '') && i < text.length) i++; };
  const string = () => { const start = i++; while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i++] === '"') return JSON.parse(text.slice(start, i)); } throw new Error('JSON_UNTERMINATED_STRING'); };
  const value = () => {
    ws(); const c = text[i];
    if (c === '"') return string();
    if (c === '{') {
      i++; ws(); const o = {}, seen = new Set(); if (text[i] === '}') { i++; return o; }
      for (;;) { ws(); if (text[i] !== '"') throw new Error('JSON_KEY_REQUIRED'); const k = string(); if (seen.has(k)) throw new Error('JSON_DUPLICATE_KEY'); seen.add(k); ws(); if (text[i++] !== ':') throw new Error('JSON_COLON_REQUIRED'); o[k] = value(); ws(); const end = text[i++]; if (end === '}') return o; if (end !== ',') throw new Error('JSON_COMMA_REQUIRED'); }
    }
    if (c === '[') { i++; ws(); const a = []; if (text[i] === ']') { i++; return a; } for (;;) { a.push(value()); ws(); const end = text[i++]; if (end === ']') return a; if (end !== ',') throw new Error('JSON_COMMA_REQUIRED'); } }
    const match = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(i));
    if (!match) throw new Error('JSON_VALUE_REQUIRED'); i += match[0].length; return JSON.parse(match[0]);
  };
  const result = value(); ws(); if (i !== text.length) throw new Error('JSON_TRAILING_DATA'); return result;
}

const keywords = new Set(['$schema','$id','$comment','$defs','$ref','title','description','type','const','enum','required','properties','patternProperties','additionalProperties','unevaluatedProperties','oneOf','anyOf','allOf','if','then','else','not','items','prefixItems','minItems','maxItems','uniqueItems','minProperties','maxProperties','minimum','maximum','minLength','maxLength','pattern','format']);
const schemaMaps = new Set(['$defs','properties','patternProperties']);
const schemaArrays = new Set(['oneOf','anyOf','allOf','prefixItems']);
const schemaSingles = new Set(['additionalProperties','unevaluatedProperties','items','if','then','else','not']);
const formats = {
  uuid: s => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s),
  'date-time': s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s) && Number.isFinite(Date.parse(s)),
  uri: s => { try { return Boolean(new URL(s).protocol); } catch { return false; } }
};
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function compile202012(root) {
  assert.equal(root.$schema, 'https://json-schema.org/draft/2020-12/schema');
  const resolve = ref => {
    assert(ref.startsWith('#/'), `external $ref prohibited: ${ref}`);
    let x = root; for (const k of ref.slice(2).split('/')) x = x[k.replace(/~1/g,'/').replace(/~0/g,'~')];
    assert(x !== undefined, `unresolved $ref ${ref}`); return x;
  };
  const check = s => {
    if (typeof s === 'boolean') return;
    assert(isObject(s), 'schema must be object or boolean');
    for (const [k,v] of Object.entries(s)) {
      assert(keywords.has(k) || k.startsWith('x-steer-'), `unsupported schema keyword ${k}`);
      if (schemaMaps.has(k)) for (const child of Object.values(v)) check(child);
      if (schemaArrays.has(k)) v.forEach(check);
      if (schemaSingles.has(k)) check(v);
      if (k === '$ref') resolve(v);
      if (k === 'format') assert(formats[v], `unsupported format ${v}`);
      if (k === 'pattern') new RegExp(v, 'u');
    }
  };
  check(root);
  function evaluate(s, data, at = '') {
    const errors = [], evaluated = new Set();
    const err = code => errors.push(`${at}/${code}`);
    const merge = result => { errors.push(...result.errors); for (const p of result.evaluated) evaluated.add(p); };
    if (s === true) return {errors,evaluated};
    if (s === false) { err('falseSchema'); return {errors,evaluated}; }
    if (s.$ref) merge(evaluate(resolve(s.$ref), data, at));
    if (s.type) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      const match = t => t === 'null' ? data === null : t === 'array' ? Array.isArray(data) : t === 'object' ? isObject(data) : t === 'integer' ? Number.isSafeInteger(data) : t === 'number' ? typeof data === 'number' && Number.isFinite(data) : typeof data === t;
      if (!types.some(match)) { err('type'); return {errors,evaluated}; }
    }
    if ('const' in s && !equal(s.const, data)) err('const');
    if (s.enum && !s.enum.some(x => equal(x,data))) err('enum');
    if (typeof data === 'string') {
      if (s.minLength !== undefined && [...data].length < s.minLength) err('minLength');
      if (s.maxLength !== undefined && [...data].length > s.maxLength) err('maxLength');
      if (s.pattern && !new RegExp(s.pattern,'u').test(data)) err('pattern');
      if (s.format && !formats[s.format](data)) err('format');
    }
    if (typeof data === 'number') {
      if (s.minimum !== undefined && data < s.minimum) err('minimum');
      if (s.maximum !== undefined && data > s.maximum) err('maximum');
    }
    if (isObject(data)) {
      if (s.minProperties !== undefined && Object.keys(data).length < s.minProperties) err('minProperties');
      if (s.maxProperties !== undefined && Object.keys(data).length > s.maxProperties) err('maxProperties');
      for (const k of s.required || []) if (!Object.hasOwn(data,k)) err(`required/${k}`);
      for (const [k,v] of Object.entries(s.properties || {})) if (Object.hasOwn(data,k)) { evaluated.add(k); merge(evaluate(v,data[k],`${at}/properties/${k}`)); }
      for (const [p,v] of Object.entries(s.patternProperties || {})) for (const k of Object.keys(data)) if (new RegExp(p,'u').test(k)) { evaluated.add(k); merge(evaluate(v,data[k],`${at}/patternProperties/${p}`)); }
      if (s.additionalProperties !== undefined) for (const k of Object.keys(data)) if (!(k in (s.properties || {})) && !Object.keys(s.patternProperties || {}).some(p => new RegExp(p,'u').test(k))) {
        evaluated.add(k); if (s.additionalProperties === false) err(`additionalProperties/${k}`); else merge(evaluate(s.additionalProperties,data[k],`${at}/additionalProperties/${k}`));
      }
    }
    if (Array.isArray(data)) {
      if (s.minItems !== undefined && data.length < s.minItems) err('minItems');
      if (s.maxItems !== undefined && data.length > s.maxItems) err('maxItems');
      if (s.uniqueItems && new Set(data.map(x=>JSON.stringify(x))).size !== data.length) err('uniqueItems');
      for (let i=0;i<data.length;i++) {
        if (s.prefixItems?.[i] !== undefined) merge(evaluate(s.prefixItems[i],data[i],`${at}/prefixItems/${i}`));
        else if (s.items !== undefined) merge(evaluate(s.items,data[i],`${at}/items/${i}`));
      }
    }
    if (s.allOf) s.allOf.forEach((v,i)=>merge(evaluate(v,data,`${at}/allOf/${i}`)));
    if (s.oneOf) {
      const results = s.oneOf.map(v=>evaluate(v,data,at)); const valid = results.filter(r=>r.errors.length===0);
      if (valid.length !== 1) { err('oneOf'); const discriminated = results.find(r=>r.errors.some(e=>e.endsWith('/unevaluatedProperties'))); if (discriminated) errors.unshift(`${at}/unevaluatedProperties`); }
      else for (const p of valid[0].evaluated) evaluated.add(p);
    }
    if (s.anyOf) { const valid = s.anyOf.map(v=>evaluate(v,data,at)).filter(r=>r.errors.length===0); if (!valid.length) err('anyOf'); else valid.forEach(r=>r.evaluated.forEach(p=>evaluated.add(p))); }
    if (s.not && !evaluate(s.not,data,at).errors.length) err('not');
    if (s.if) { const branch = evaluate(s.if,data,at).errors.length ? s.else : s.then; if (branch) { const r=evaluate(branch,data,`${at}/then`); if(r.errors.length) err('then'); else merge(r); } }
    if (isObject(data) && s.unevaluatedProperties === false) for (const k of Object.keys(data)) if (!evaluated.has(k)) { err('unevaluatedProperties'); break; }
    return {errors,evaluated};
  }
  return data => evaluate(root,data).errors;
}
