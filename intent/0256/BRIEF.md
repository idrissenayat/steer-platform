# Brief

An intent can change after generation, and its assessment can expire. STEER still
needs to verify the exact historical inputs before explaining original versus
edited documents or preparing a save. Current-only admission must not be weakened
to make that history readable.

Add explicit server-side historical input recovery under current source, records,
key and history permissions. Preserve original content and assessment identity;
do not infer output authorship or expose private prompts to the browser.
