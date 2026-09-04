import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile202012,parseStrict} from '../../round-2/remediation/schema-validator.candidate.mjs';
import {clone} from './strict-evidence.candidate.mjs';

const schemaDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'schemas');
const safeName=name=>`external_${name.replace(/[^A-Za-z0-9_]/g,'_')}`;

export function schemaRegistry(){
  const names=fs.readdirSync(schemaDir).filter(name=>name.endsWith('.schema.json')).sort();
  const schemas=new Map(names.map(name=>[name,parseStrict(fs.readFileSync(path.join(schemaDir,name),'utf8'))]));
  const ids=new Set();
  for(const [name,schema] of schemas){
    if(typeof schema.$id!=='string'||ids.has(schema.$id))throw new Error(`SCHEMA_ID_INVALID_OR_DUPLICATE:${name}`);
    ids.add(schema.$id);
  }
  return schemas;
}

export function bundleSchema(name,registry=schemaRegistry()){
  if(!registry.has(name))throw new Error(`SCHEMA_NOT_FOUND:${name}`);
  const root=clone(registry.get(name));root.$defs??={};
  const embedded=new Set();
  const rewrite=(node,currentName)=>{
    if(Array.isArray(node)){node.forEach(value=>rewrite(value,currentName));return;}
    if(!node||typeof node!=='object')return;
    if(typeof node.$ref==='string'){
      if(node.$ref.startsWith('#/')){
        if(currentName!==name)node.$ref=`#/$defs/${safeName(currentName)}${node.$ref.slice(1)}`;
      }else{
        const [target,fragment='']=node.$ref.split('#');
        if(!registry.has(target))throw new Error(`SCHEMA_EXTERNAL_REF_UNRESOLVED:${currentName}:${node.$ref}`);
        if(!embedded.has(target)){
          embedded.add(target);
          const child=clone(registry.get(target));delete child.$schema;delete child.$id;
          root.$defs[safeName(target)]=child;
          rewrite(child,target);
        }
        node.$ref=`#/$defs/${safeName(target)}${fragment}`;
      }
    }
    for(const value of Object.values(node))rewrite(value,currentName);
  };
  rewrite(root,name);
  return root;
}

export function compileOffline(name,registry=schemaRegistry()){
  return compile202012(bundleSchema(name,registry));
}

export function compileAllOffline(){
  const registry=schemaRegistry(),compiled=new Map();
  for(const name of registry.keys())compiled.set(name,compileOffline(name,registry));
  return compiled;
}
