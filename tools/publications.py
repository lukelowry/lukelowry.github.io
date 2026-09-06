"""Compare public ORCID/DOI records with the approved bibliography; never edit it."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote
from urllib.request import Request, urlopen

import yaml

ROOT = Path(__file__).resolve().parents[1]


def title_key(value):
    return re.sub(r"[^\w]", "", unicodedata.normalize("NFKD", value).casefold())


def bibliography(text):
    """Read braced/quoted BibTeX fields without rewriting or normalizing the source."""
    entries = []
    for match in re.finditer(r"@\w+\s*\{\s*([^,]+),", text):
        position = match.end()
        fields = {"key": match.group(1).strip()}
        while position < len(text):
            field = re.match(r"\s*,?\s*(\w+)\s*=\s*", text[position:])
            if not field:
                break
            name = field.group(1).lower()
            position += field.end()
            start = position
            if text[position] == "{":
                depth = 1
                position += 1
                start = position
                while position < len(text) and depth:
                    if text[position] == "{" and text[position - 1] != "\\":
                        depth += 1
                    if text[position] == "}" and text[position - 1] != "\\":
                        depth -= 1
                    position += 1
                fields[name] = text[start:position - 1]
            elif text[position] == '"':
                position += 1
                start = position
                while position < len(text) and (text[position] != '"' or text[position - 1] == "\\"):
                    position += 1
                fields[name] = text[start:position]
                position += 1
            else:
                while position < len(text) and text[position] not in ",}":
                    position += 1
                fields[name] = text[start:position].strip()
        if "title" in fields:
            entries.append(fields)
    return entries


def fetch_json(url):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "LukeLowery-PublicationReview/1.0"})
    with urlopen(request, timeout=25) as response:
        data = json.load(response)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid response from {url}")
    return data


def orcid_works(data):
    if "group" not in data:
        raise ValueError("ORCID response has no work groups; retaining the previous report")
    records = []
    for group in data["group"]:
        for work in group.get("work-summary", []):
            title = work["title"]["title"]["value"]
            ids = work.get("external-ids", {}).get("external-id", [])
            dois = [i["external-id-value"].lower() for i in ids if i.get("external-id-type") == "doi" and i.get("external-id-relationship") == "self"]
            records.append({"title": title, "doi": dois[0] if dois else None, "orcid_put_code": work["put-code"]})
    return records


def compare(approved, records, fetch=fetch_json):
    by_doi = {p["doi"].lower(): p for p in approved if p.get("doi")}
    by_title = {title_key(p["title"]): p for p in approved}
    candidates, differences, duplicates = [], [], []
    grouped = {}
    for work in records:
        grouped.setdefault(title_key(work["title"]), []).append(work)
    for works in grouped.values():
        if len(works) > 1:
            duplicates.append(works)
        # A possible title duplicate is reported, never merged back into ORCID or the website.
        for work in works:
            original = by_doi.get(work["doi"]) or by_title.get(title_key(work["title"]))
            metadata = None
            if work["doi"]:
                response = fetch("https://api.crossref.org/works/" + quote(work["doi"], safe=""))
                metadata = response.get("message")
                if not isinstance(metadata, dict) or metadata.get("DOI", "").lower() != work["doi"]:
                    raise ValueError("DOI response mismatch; retaining the previous report")
            proposed = {"doi": work["doi"]}
            if metadata:
                proposed.update({"title": metadata.get("title", [work["title"]])[0],
                                 "journal": metadata.get("container-title", [""])[0],
                                 "volume": metadata.get("volume"), "number": metadata.get("issue"),
                                 "pages": metadata.get("page"),
                                 "year": metadata.get("published", {}).get("date-parts", [[None]])[0][0]})
            if original is None:
                candidates.append({**work, "metadata": proposed})
            else:
                changes = {k: {"current": original.get(k), "source": v} for k, v in proposed.items()
                           if v and (str(original.get(k, "")).casefold() if k == "doi" else str(original.get(k, "")).replace("--", "-")) != (str(v).casefold() if k == "doi" else str(v))}
                if changes:
                    differences.append({"key": original["key"], "changes": changes})
    return {"candidates": candidates, "metadata_differences": differences,
            "possible_orcid_duplicates": duplicates,
            "approved_without_doi": [p["key"] for p in approved if not p.get("doi")]}


def run(output):
    output = output.resolve()
    output.relative_to(ROOT / "output")  # Reports cannot be written into published content.
    socials = yaml.safe_load((ROOT / "_data/socials.yml").read_text(encoding="utf-8"))
    orcid = socials["orcid_id"]
    approved = bibliography((ROOT / "_bibliography/papers.bib").read_text(encoding="utf-8"))
    records = orcid_works(fetch_json(f"https://pub.orcid.org/v3.0/{orcid}/works"))
    if not records and approved:
        raise ValueError("Empty ORCID result; retaining the previous report")
    report = {"last_successful_check": datetime.now(timezone.utc).isoformat(),
              "orcid": orcid, "approved_count": len(approved), "orcid_record_count": len(records),
              **compare(approved, records)}
    output.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    temporary = output / "review.json.tmp"
    temporary.write_text(encoded, encoding="utf-8")
    temporary.replace(output / "review.json")
    (output / "review.md").write_text("# Publication review\n\nUnpublished comparison only. Luke owns all website text and publication edits.\n\n```json\n" + encoded + "```\n", encoding="utf-8")
    print(f"Compared {len(approved)} approved entries with {len(records)} ORCID records: {output / 'review.md'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output/publications")
    try:
        run(parser.parse_args().output)
    except Exception as error:
        parser.exit(1, f"Publication review failed: {error}\n")
