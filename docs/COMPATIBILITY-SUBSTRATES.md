# Compatibility Substrates

Nolane Agent has a Nolane-owned product shell and runtime composition, but some historical substrates remain intentionally packaged while replacement work is verified.

## ForgeOS boundary

`vendor/forge-os` is still packaged by `electron-builder.config.cjs` and behavior is consumed through `ForgeOsBridge`. It is a compatibility and authority substrate, not the current product identity.

Removal is allowed only when:

1. every consumed behavior has a Nolane-owned replacement;
2. characterization and parity tests pass;
3. route, receipt, policy, worktree and completion behavior remain compatible;
4. delivery artifacts no longer package or import the substrate; and
5. a migration note records the retirement.

Documentation must not claim ForgeOS is absent while those conditions are false.

## Legacy UI boundary

`ui-v3` is the editable progressive UI source. `ui-dist` is its generated production projection. `ui` remains an explicit recovery/compatibility surface until feature parity and recovery-entry tests permit retirement.

## Update trust configuration

`config/update.json` and the update public key are release-generated inputs. Their packaging entry does not imply that production trust material is committed as a normal source file.
