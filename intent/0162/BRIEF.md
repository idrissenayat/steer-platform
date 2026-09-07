# Brief

The audit found that browser readback/projection evidence begins from seeded Git
history. Storage creation is tested separately, but that is not evidence that the
shared HTTP preview/save path produces those bytes and then projects the receipt.
Close that integration gap with disposable Git/PostgreSQL and explicit synthetic
identity/authority test doubles. Do not fabricate live gate approval or enable UI saves.
