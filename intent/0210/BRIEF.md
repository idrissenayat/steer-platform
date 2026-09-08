# Brief

Connect the candidate-bundle writer to durable operation ownership so independent
worker instances cannot resend a save after restart, lost acknowledgement or an
absent receipt. Preserve exact document/consent binding and the original receipt
while resolving the dependency between a server-minted ID and its final write hash.
Test the combined SQL/Git boundary without enabling live authority or publication.
