# Publication maintenance

Run `python -m pip install -r tools/requirements-publications.txt`, then
`npm run publications:review`. Read `output/publications/review.md` or `review.json`.
The report includes new-work candidates, metadata differences, missing DOI identifiers, possible
ORCID duplicates, and the last successful check time. Network or malformed-response failures are
nonzero exits and preserve the last JSON report. Reports are never copied into the website.

ORCID is the discovery source. Crossref provides DOI metadata. Title matches only identify review
candidates; they never merge records automatically. Preprints, conference publications, and works
without DOI metadata remain under manual editorial control. Scholar remains linked in profile
metadata. Citation badges are optional; counts are not a substitute for publication synchronization.

The GitHub review workflow uploads an artifact and job summary. It has read-only repository
permissions and never commits, pushes, opens a PR, or deploys content. Its weekly schedule also
runs on relevant source changes and can be triggered manually after it is published.

Account actions are separate from local repository edits: enable Crossref/ORCID auto-updates,
reconcile duplicate ORCID works, and check Search Console ownership/indexing manually. Public
GitHub schedules can be disabled after 60 days of repository inactivity; inspect the Actions UI
when returning after a long gap. Do not create artificial keepalive commits.

Sources:

- https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
