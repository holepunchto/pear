# Platform Release Checklist

**Legend:** [ 2M ] - Second Machine

## Dev

- [ ] `./pear.dev sidecar shutdown`
- [ ] `git pull`
- [ ] `npm install`
- [ ] `rm -fr by-arch`
- [ ] `npm run archdump`
- [ ] `rm -fr node_modules`
- [ ] `npm install --omit=dev`
- [ ] `npm run prune`
- [ ] `./pear.dev sidecar` (own terminal)
- [ ] `./pear.dev seed dev` (own terminal)
- [ ] `./pear.dev stage --dry-run dev`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ 2M ] `pear sidecar --key=[devkey]`
    - [ ] - [ 2M ] `pear sidecar`
      - **[ 2M ] Version is latest?**
        - [ ] NO: wait for update, then [ 2M ] `pear sidecar`
        - [ ] YES: continue
    - [ ] -  [ 2M ] Open Keet
    - [ ] - `./pear.dev stage dev`
    - **[ 2M ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ 2M ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - [ 2M ] `pear sidecar`
            - **[ 2M ] System Pear is Latest `dev`?**
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
- **System Pear is on Latest Devkey?**
  - [ ] - NO: ensure devkey is seeding, ensure pear sidecar --key is correct, ensure sys sidecar is on latest, then continue
  - [ ] - YES: continue
- [ ] - `pear seed staging` (own terminal)
- [ ] - `pear dump <devkey> .`
- [ ] - `pear stage --dry-run staging`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ 2M ] `pear sidecar --key=[stagekey]`
    - [ ] - [ 2M ] `pear sidecar`
      - **[ 2M ] Version is latest?**
        - [ ] NO: wait for update, then [ 2M ] `pear sidecar`
        - [ ] YES: continue
    - [ ] -  [ 2M ] Open Keet
    - [ ] - `pear stage staging`
    - **[ 2M ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ 2M ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - [ 2M ] `pear sidecar`
             - **[ 2M ] System Pear is Latest `staging`?**
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
- **System Pear is on Latest Stagekey or on Devkey matching Stagekey?**
  - [ ] - NO: ensure stagekey is seeding, ensure `pear sidecar --key` is correct, ensure sys sidecar is on latest, then continue
  - [ ] - YES: continue
- [ ] - `pear seed staging` (own terminal)
- [ ] - `pear dump <devkey> .`
- [ ] - `pear stage --dry-run staging`
- [ ] - `pear seed rc` (own terminal)
- [ ] - `pear dump <stagekey> .`
- [ ] - `pear stage --dry-run rc`
- **Dry Run Correct?**
  - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
  - [ ] - YES: 
    - [ ] - [ 2M ] `pear sidecar --key=[stagekey]`
    - [ ] - [ 2M ] `pear sidecar`
      - **[ 2M ] Version is latest?**
        - [ ] NO: wait for update, then [ 2M ] `pear sidecar`
        - [ ] YES: continue
    - [ ] - [ 2M ] Open Keet
    - [ ] - `pear stage staging`
    - **[ 2M ] Update observed in Sidecar and Keet?**
      - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
      - [ ] - YES: 
        - **[ 2M ] Platform Restart via Keet Button successful?**
          - [ ] - NO: diagnose, correct, [restart](./CHECKLIST.md)
          - [ ] - YES:
            - [ ] - [ 2M ] `pear sidecar`
            - **System Pear is Latest Release-Candidate?**
              - [ ] - NO: diagnose, correct, if platform issue resolved, [restart](./CHECKLIST.md)
              - [ ] - YES: await QA Approval then continue to **Production**

## Production

- **Has Drive Watcher triggered in Keet Multisig Room and have two stakeholders signed blobs and drive?**
  - [ ] - NO: await stakeholder signing
  - [ ] - YES: use signatures to write to production hypercore [ TODO: SPECIFIC STEPS ]