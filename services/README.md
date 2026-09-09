# services

Long-running processes.

Empty for now, on purpose. The control plane lands here at slice 3, when the node
boundary becomes real: the control plane and the node agent become two processes
talking over HTTP, even though both run on one machine.

That split is not negotiable, and it happens early for a reason. Building the two
halves inside one process and separating them later means discovering at the worst
possible moment that the separation was never real.

The control plane keeps the three things that must never be distributed: the event
log, the authority check, and the credentials. Everything else is compute, and
compute belongs wherever the work is.
