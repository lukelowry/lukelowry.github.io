---
layout: page
title: sgwt
description: A power systems oriented Python module for the SGWT & sparse graph convolutions
img: /assets/img/USA_Wavelet.png
importance: 1
category: work
related_publications: true
---

Every project has a beautiful feature showcase page.
It's easy to include images in a flexible 3-column grid format.
Make your photos 1/3, 2/3, or full width.



The GitHub repository for the `sgwt` package is available [here](https://github.com/lukelowry/sparse-sgwt).

I will soon upload a preprint for a TPEC paper that details the math used in the package.

Kernel Fitted Functions
------

The kernel fitting representation \eqref{eq:vec-fit} is more generally a vector fitted function

$$
f_a(\mathbf{\Lambda})\approx 
        d_aI + e_a\mathbf{\Lambda}
        + \sum_{q\in Q}\dfrac{r_{q,a}}{\mathbf{\Lambda}+qI} 
   \label{eq:vec-fit} \tag{1}
$$

The table will eventually contain the poles and residues of various popular filters.

| Spectral Function   | Poles   | VF Data             |
| --------            | ------  | ------------------- | 
| Mexican Hat         | 14       | [Download](/files/VF_FUNCS/MEXICAN_HAT.json)         |
| Gaussian Wavelet    | 16       | [Download](/files/VF_FUNCS/GAUSSIAN_WAV.json)        |
| Modified Morlet     | 14       | [Download](/files/VF_FUNCS/MODIFIED_MORLET.json)        |
| Shannon Wavelet     | 50      | [Download](/files/VF_FUNCS/SHANNON.json)        |

Low-Pass Spectral Graph Filter
------

The low-pass filter \eqref{eq:lowpass} is *refinable*, as it is a self-similar rational function. The refinability of \eqref{eq:lowpass} makes it useful for signal smoothing across a range of spatial scales.

$$
\phi(\mathbf{\Lambda}) = \dfrac{I}{\mathbf{\Lambda}+I} \label{eq:lowpass} \tag{2}
$$


High-Pass Spectral Graph Filter
------

The proposed high-pass filter \eqref{eq:highpass} acts as a container for variations over the graph below a given spatial scale.

$$
\mu(\mathbf{\Lambda}) = \dfrac{\mathbf{\Lambda}}{\mathbf{\Lambda}+I}  \label{eq:highpass}  \tag{3}
$$


Band-Pass Spectral Graph Filter
------

A convenient closed-form wavelet generating kernel \eqref{eq:band-pass} was found to be a useful kernel as an alternative to the vector-fitting procedure if a particular filter does not need to be designed. 

$$
\Psi(\mathbf{\Lambda}) = \dfrac{4\mathbf{\Lambda}}{(\mathbf{\Lambda}+I)^2}  \label{eq:band-pass} \tag{4} 
$$

This filter qualifies as a wavelet generating kernel for the SGWT, since \\(\Psi(0)=0\\) and the admissibility condition is satisfied. The admissibility constant of this band-pass filter is  \\(C_f=8/3\\).

$$
\Psi(0)=0  \qquad\text{and}\quad \int_0^{\infty}\dfrac{\Psi^2(x)}{x}\mathrm{d}x <\infty
$$



<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/1.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/3.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/5.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Caption photos easily. On the left, a road goes through a tunnel. Middle, leaves artistically fall in a hipster photoshoot. Right, in another hipster photoshoot, a lumberjack grasps a handful of pine needles.
</div>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/5.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    This image can also have a caption. It's like magic.
</div>

You can also put regular text between your rows of images, even citations {% cite einstein1950meaning %}.
Say you wanted to write a bit about your project before you posted the rest of the images.
You describe how you toiled, sweated, _bled_ for your project, and then... you reveal its glory in the next row of images.

<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.liquid path="assets/img/6.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm-4 mt-3 mt-md-0">
        {% include figure.liquid path="assets/img/11.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    You can also have artistically styled 2/3 + 1/3 images, like these.
</div>

The code is simple.
Just wrap your images with `<div class="col-sm">` and place them inside `<div class="row">` (read more about the <a href="https://getbootstrap.com/docs/4.4/layout/grid/">Bootstrap Grid</a> system).
To make images responsive, add `img-fluid` class to each; for rounded corners and shadows use `rounded` and `z-depth-1` classes.
Here's the code for the last row of images above:

{% raw %}

```html
<div class="row justify-content-sm-center">
  <div class="col-sm-8 mt-3 mt-md-0">
    {% include figure.liquid path="assets/img/6.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
  </div>
  <div class="col-sm-4 mt-3 mt-md-0">
    {% include figure.liquid path="assets/img/11.jpg" title="example image" class="img-fluid rounded z-depth-1" %}
  </div>
</div>
```

{% endraw %}
