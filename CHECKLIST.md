# Platform Release Checklist

## Dev

- [ ] `./pear.dev sidecar shutdown`
- [ ] `git pull`
- **Build Update?**
  - [ ] NO: continue
  - [ ] YES: 
    - [ ] `npm install`
    - [ ] `npm run bootstrap -- --dlruntime`
- [ ] `rm -fr node_modules`
- [ ] `npm install --omit=dev`
- [ ] `npm run prune`
- [ ] `./pear.dev sidecar` (own terminal)
- [ ] `./pear.dev seed dev` (own terminal)
- [ ] `./pear.dev stage --dry-run dev`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ SECOND MACHINE ] `pear sidecar --key=[devkey]`
    - [ ] - [ SECOND MACHINE ] `pear sidecar` 
      - **Version is latest?**
        - [ ] NO: wait for update, then `pear sidecar`
        - [ ] YES: continue
    - [ ] -  [ SECOND MACHINE ] Open Keet
    - [ ] - `./pear.dev stage dev`
    - **[ SECOND MACHINE ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ SECOND MACHINE ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - `pear sidecar` (own terminal)
            - **System Pear is Latest `dev`?**
              - [ ] - NO: diagnose, correct, if platform issue resolved, [restart](./CHECKLIST.md), if system issue resolved then YES
              - [ ] - YES:
                  - **RC Versioned?**
                    - [ ] - NO:
                      - [ ] - `npm version <major.minor.patch-rc.n>`, `git push --follow-tags`
                      - [ ] - [restart](./CHECKLIST.md)
                    - [ ] - YES: continue to **Staging**
 

## Staging

- **RC Versioned?**
  - [ ] - NO: complete **Dev**
  - [ ] - YES: continue
- [ ] - `pear seed staging` (own terminal)
- [ ] - `pear dump <devkey> .`
- [ ] - `pear stage --dry-run staging`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ SECOND MACHINE ] `pear sidecar --key=[stagekey]`
    - [ ] - [ SECOND MACHINE ] `pear sidecar` 
      - **Version is latest?**
        - [ ] NO: wait for update, then `pear sidecar`
        - [ ] YES: continue
    - [ ] -  [ SECOND MACHINE ] Open Keet
    - [ ] - `pear stage staging`
    - **[ SECOND MACHINE ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ SECOND MACHINE ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - `pear sidecar` (own terminal)
             - **System Pear is Latest `staging`?**
              - [ ] - NO: diagnose, correct, if platform issue resolved, [restart](./CHECKLIST.md)
              - [ ] - YES: 
                - **Only Changelog and/or Version update?** 
                  - [ ] NO: await QA Approval then YES
                  - [ ] YES:
                    - **Changelog Updated & Versioned?**
                      - [ ] - NO:
                        - [ ] - Update Changelog, `git push`
                        - [ ] - `npm version <major.minor.patch>`, `git push --follow-tags`
                        - [ ] - Complete **Dev** & **Staging** Checklists
                      - [ ] - YES: continue to **Release-Candidate**


## Release-Candidate

- **Changelog Updated & Versioned?**
  - [ ] - NO:
    - [ ] - complete **Staging**
  - [ ] YES: continue
- [ ] - `pear seed rc` (own terminal)
- [ ] - `pear dump <stagekey> .`
- [ ] - `pear stage --dry-run rc`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ SECOND MACHINE ] `pear sidecar --key=[stagekey]`
    - [ ] - [ SECOND MACHINE ] `pear sidecar` 
      - **Version is latest?**
        - [ ] NO: wait for update, then `pear sidecar`
        - [ ] YES: continue
    - [ ] - [ SECOND MACHINE ] Open Keet
    - [ ] - `pear stage staging`
    - **[ SECOND MACHINE ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ SECOND MACHINE ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - `pear sidecar` (own terminal)
            - **System Pear is Latest Release-Candidate?**
              - [ ] - NO: diagnose, correct, if platform issue resolved, [restart](./CHECKLIST.md)
              - [ ] - YES: await QA Approval then continue to **Production**

## Production

- **Has Drive Watcher triggered in Keet Multisig Room and have two stakeholders signed blobs and drive?**
  - [ ] - NO: await stakeholder signing
  - [ ] - YES: use signatures to write to production hypercore [ TODO: SPECIFIC STEPS ]