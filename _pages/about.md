---
layout: about
grid_backdrops: true
title: about
permalink: /
subtitle: <a href='https://engineering.tamu.edu/electrical/index.html' target="_blank" rel="noopener noreferrer">Texas A&M University<span class="sr-only">(opens in a new tab/external site)</span></a> of College Station, TX

profile:
  align: right
  image: prof_pic.jpg
  image_circular: false # crops the image to make it circular
  more_info: >
    <p>coding, probably</p>

selected_papers: true # includes a list of papers marked as "selected={true}"
social: false # includes social icons at the bottom of the page
---

<div class="home-scene home-scene-usa" data-grid-section="USA" markdown="1">
<div class="home-copy" markdown="1">

<section class="home-research-step" markdown="1">

Indiscriminate access to secure, sustainable, and affordable energy is not a privilege; it is a right. My research and career are dedicated to making this a reality through the advancement of electrical power systems.

</section>

<section class="home-research-step" markdown="1">

large power system stability
------

My primary field of research is in large power system stability, including 
but not limited to: modal analysis, propagative EMT simulation, and the convergence of power flow.

</section>

</div>
</div>

<div class="home-scene home-scene-europe" data-grid-section="EuropeA" markdown="1">
<div class="home-copy" markdown="1">

<section class="home-research-step" markdown="1">

graph signal processing
------

GSP is an emerging field that extends DFT to non-trivial topologies. Notably, power system engineers inadvertently contributed to this field gaining traction through developments in sparse network dynamics.

</section>

<section class="home-research-step" markdown="1">

engineering education
------

There is a deficit of modern educational tools used by instructors in electrical engineering. Modern animation tools and software can be used to illuminate the student experience, reach broader audiences, and bring clarity to age-old analysis.

</section>

{% if page.selected_papers %}
<section class="home-publications home-research-step">
  <h2><a href="{{ '/publications/' | relative_url }}">selected publications</a></h2>
  {% include selected_papers.liquid %}
</section>
{% endif %}

</div>
</div>
