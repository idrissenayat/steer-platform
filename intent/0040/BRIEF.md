# Brief

The authorized scheduling tools need a connection owner when composed into the
platform runtime. A request may still be starting a workflow or checking its
status while shutdown begins. Stop new admission, retain in-flight operations,
then close only the owned connection and report any cleanup failure honestly.

Configuration must explicitly opt in and match the existing identity runtime's
organization/repository and the scheduler's item and limits. Keep SDK code outside
the API/core and leave provider security and live deployment approval separate.
