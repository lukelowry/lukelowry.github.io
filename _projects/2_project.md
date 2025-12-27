---
layout: page
title: project 2
description: a project with a background image and giscus comments
img: assets/img/3.jpg
importance: 2
category: work
giscus_comments: false
---

The following graph laplacians are provided and documented for reusability.
They are stored in CSC data structure using the `.npz` file format.

Needs to be validated further for the larger cases.

Vertex Domain Features
------

Various signals that exist over the corresponding graphs such as:
  * Longitude
  * Latitude

| Synthetic Case   | Verticies   | Vertex Features     |
| --------         | ------      | ------------------- | 
| Hawaii           | 37          | [Download]          | 
| WECC             | 240         | [Download]()        | 
| Texas            | 2000        | [Download]()        | 
| Eastern Inter.   | 78000       | [Download]()        | 
| USA              | 82000       | [Download]()        | 


Length Based Laplacians
------
  * [Hawaii 37 Bus](/_data/laplace_library/DELAY/HAWAII_LENGTH.npz)
  * [WECC 240 Bus](/_data/laplace_library/DELAY/WECC_LENGTH.npz)
  * [Texas 2000 Bus](/_data/laplace_library/DELAY/TEXAS_LENGTH.npz)
  * [Eastern 78k Bus](/_data/laplace_library/DELAY/EASTWEST_LENGTH.npz)
  * [USA 82k Bus](/_data/laplace_library/DELAY/USA_LENGTH.npz)

Delay Based Laplacians
------

  * [Hawaii 37 Bus](/_data/laplace_library/DELAY/HAWAII_DELAY.npz)
  * [WECC 240 Bus](/_data/laplace_library/DELAY/WECC_DELAY.npz)
  * [Texas 2000 Bus](/_data/laplace_library/DELAY/TEXAS_DELAY.npz)
  * [Eastern 78k Bus](/_data/laplace_library/DELAY/EASTWEST_DELAY.npz)
  * [USA 82k Bus](/_data/laplace_library/DELAY/USA_DELAY.npz)

  
Admittance Based Laplacians
------

  * [Hawaii 37 Bus](/_data/laplace_library/DELAY/HAWAII_IMPEDANCE.npz)
  * [WECC 240 Bus](/_data/laplace_library/DELAY/WECC_IMPEDANCE..npz)
  * [Texas 2000 Bus](/_data/laplace_library/DELAY/TEXAS_IMPEDANCE..npz)
  * [Eastern 78k Bus](/_data/laplace_library/DELAY/EASTWEST_IMPEDANCE..npz)
  * [USA 82k Bus](/_data/laplace_library/DELAY/USA_IMPEDANCE..npz)