# Triage Labels

Matt Pocock skills speak in five canonical triage roles. This repo uses the default strings for those roles.

| Label in skills   | Label in Beads    | Meaning                                  |
| ----------------- | ----------------- | ---------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human` | Requires human implementation            |
| `wontfix`         | `wontfix`         | Will not be actioned                     |

When a skill mentions a role, use the corresponding Beads label from this table.

Morpheus `agent:*` workflow labels are not triage labels. They model Morpheus daemon state and must remain separate from these triage roles.
