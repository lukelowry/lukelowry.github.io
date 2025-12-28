---
layout: page
title: ESA Extensions
description: A fork of Easy Sim Auto to accelerate power system research
img: assets/img/GWB.png
importance: 3
category: work
giscus_comments: false
---

Over my graduate education, the <a href="https://github.com/lukelowry/GridWorkBenchESA">ESA Fork</a> I developed to use `numpy` style indexing to access PowerWorld parameters through Sim Auto.

### Example

As a brief showcase, you can easily retireve all fields of `Bus` objects using the following notation,

```python
data = wb[Bus,:]
```

Please see the repository for full documentation.
