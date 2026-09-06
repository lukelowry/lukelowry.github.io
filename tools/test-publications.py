import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("publications", Path(__file__).with_name("publications.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PublicationsTests(unittest.TestCase):
    def test_braces_quotes_and_no_rewriting(self):
        source = '@article{x, title={A {Nested} Title}, year="2025", doi={10.1/a}}'
        self.assertEqual(module.bibliography(source)[0], {"key": "x", "title": "A {Nested} Title", "year": "2025", "doi": "10.1/a"})

    def test_differences_and_candidates_do_not_mutate_approved(self):
        approved = [{"key": "x", "title": "Existing", "doi": "10.1/A", "year": "2025"}]
        records = [{"title": "Existing", "doi": "10.1/a"}, {"title": "New", "doi": None}]
        report = module.compare(approved, records, lambda _: {"message": {"DOI": "10.1/a", "published": {"date-parts": [[2026]]}}})
        self.assertEqual(report["metadata_differences"][0]["changes"]["year"]["source"], 2026)
        self.assertEqual(approved[0]["year"], "2025")
        self.assertNotIn("doi", report["metadata_differences"][0]["changes"])
        self.assertEqual(report["candidates"][0]["title"], "New")

    def test_invalid_responses_fail(self):
        with self.assertRaises(ValueError):
            module.orcid_works({"error": "temporary"})
        with self.assertRaises(ValueError):
            module.compare([], [{"title": "A", "doi": "10.1/a"}], lambda _: {"message": {"DOI": "10.1/other"}})


if __name__ == "__main__":
    unittest.main()
