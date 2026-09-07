# Implementation plan

1. Add portable agent contracts and a separately granted authenticated command.
2. Add the provider-free coordinator and pinned Mastra/LiteLLM adapter.
3. Compose the service at the existing identity API runtime boundary.
4. Connect the actual signed-in free-text component and candidate document views.
5. Test authorization, budget denial, isolated Exam context, errors and UI states;
   build and restart only the owned STEER frontend/gateway processes.
6. Record exact limitations. Obtain the model budget before live activation, then
   complete gateway/budget configuration and real UI/model evaluation.
