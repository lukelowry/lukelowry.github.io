"""Regression checks for the loading image's nominal-voltage occlusion order."""
import importlib.util
from pathlib import Path
import unittest

from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("export_grids", Path(__file__).with_name("export-grids.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PosterOrderTests(unittest.TestCase):
    def paint(self, points, edges):
        picture = Image.new("RGBA", (24, 24))
        module.paint_layer_poster(ImageDraw.Draw(picture), points, [765, 765, 69, 69],
                                  edges, [0, 1, 2, 3], {69: "#358c8b", 765: "#a755a8"})
        return picture.getpixel((10, 10))

    def test_high_voltage_branch_over_lower_voltage_vertex(self):
        points = [(2, 10), (20, 10), (10, 10), (10, 20)]
        self.assertEqual(self.paint(points, [(0, 1), (2, 3)]), (167, 85, 168, 255))

    def test_high_voltage_vertex_over_lower_voltage_vertex(self):
        points = [(10, 10), (20, 10), (10, 10), (10, 20)]
        self.assertEqual(self.paint(points, [(0, 1), (2, 3)]), (167, 85, 168, 255))

    def test_branch_source_order_cannot_change_the_result(self):
        points = [(2, 10), (20, 10), (10, 2), (10, 20)]
        self.assertEqual(self.paint(points, [(0, 1), (2, 3)]), self.paint(points, [(2, 3), (0, 1)]))

    def test_parallel_branches_keep_their_individual_routes(self):
        picture = Image.new("RGBA", (24, 24))
        module.paint_layer_poster(ImageDraw.Draw(picture), [(2, 10), (20, 10)], [220, 220],
                                 [(0, 1), (0, 1)], [0, 1], {220: "#358c8b"},
                                 [[(10, 2)], [(10, 20)]])
        for point in [(10, 2), (10, 20)]:
            self.assertEqual(picture.getpixel(point), (53, 140, 139, 255))


if __name__ == "__main__":
    unittest.main()
