---
layout: page
title: projects
display_title: Projects
page_class: collection-page projects-page
permalink: /projects/
description: Completed and ongoing academic projects 
nav: true
nav_order: 2
display_categories: [work, outreach]
horizontal: false
---

{% include project-list.liquid projects=site.projects categories=page.display_categories horizontal=page.horizontal %}
