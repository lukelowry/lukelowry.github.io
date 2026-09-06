---
layout: page
title: projects
permalink: /projects/
description: Completed and ongoing academic projects 
nav: true
nav_order: 2
display_categories: [work, outreach]
horizontal: false
grid_showcase: true
---

{% include project-list.liquid projects=site.projects categories=page.display_categories horizontal=page.horizontal %}
