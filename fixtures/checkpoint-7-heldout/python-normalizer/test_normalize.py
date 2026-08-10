import unittest
from normalize import normalize


class NormalizeTests(unittest.TestCase):
    def test_trims_and_lowercases(self):
        self.assertEqual(normalize("  NoLane  "), "nolane")

    def test_empty(self):
        self.assertEqual(normalize("   "), "")


if __name__ == "__main__":
    unittest.main()
