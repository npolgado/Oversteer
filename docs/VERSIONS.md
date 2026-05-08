# Version Naming Convention

## Format

<type>_<MAJOR>_<MINOR>_<PATCH>

## Types

Beta - "dev" for pre-releases, before ready to release to steam

Release - "prod" for release updates

## Version Numbering

MAJOR: major releases, huge game updates similar to DLC's or otherwise
MINOR: game updates, balances, updates that do change the users experience or game direction
PATCH: updates that don't change the user or game mechanics, often dev updates


## Examples

dev_0.9.6 was merged to master as pre 1.0 beta 
dev_1.0.0 was released containing major changes to the game, as well as dev updates
dev_1.1.0 full TypeScript + Pixi.js port — no new user-facing mechanics, architecture overhaul

prod_1.0.0 will be the first release to make it to steam

## Git Tags

For tags, we use dev_ unless its a major change, then we use beta_