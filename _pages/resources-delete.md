---
title: "Resources"
layout: archive
permalink: /archive-layout-with-content/
---

A variety of common markup showing how the theme styles them.

# Graphs

## Laplacian Library

The following graph laplacians are provided and documented for reusability.

  * List item one 
      * List item one 
          * List item one
          * List item two
          * List item three
          * List item four
      * List item two
      * List item three
      * List item four
  * List item two
  * List item three
  * List item four



This allows you to denote <var>variables</var>.

{% include base_path %}
{% for post in site.pages %}
{% include archive-single.html %}
{% endfor %}
