---
title: "sgwt - Python Module"
excerpt: "A power systems oriented Python module for the SGWT & sparse graph convolutions<br/><img src='/images/USA_Wavelet.png'>"
collection: resources
---


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
| Mexican Hat         | 2       | [Download]()        |
| Gaussian Wavelet    | 2       | [Download]()        |

Low-Pass Spectral Graph Filter
------

The proposed low-pass filter \eqref{eq:lowpass} is *refinable*, as it is a self-similar rational function. The refinability of \eqref{eq:lowpass} makes it useful for signal smoothing across a range of spatial scales. {eq:band-pass}

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

A convenient closed-form wavelet generating kernel \eqref{eq:band-pass} was found to be a useful kernel as an alternative to the vector-fitting procedure if a particular filter does not need to be designed. Experiments have shown that \eqref{eq:band-pass} is sufficient for FOSL application.

$$
\Psi(\mathbf{\Lambda}) = \dfrac{4\mathbf{\Lambda}}{(\mathbf{\Lambda}+I)^2}  \label{eq:band-pass} \tag{4} 
$$

This filter qualifies as a wavelet generating kernel for the SGWT, since \(\Psi(0)=0\) and the admissibility condition is satisfied. The admissibility constant of this band-pass filter is  \(C_f=8/3\).

$$
\Psi(0)=0  \qquad\text{and}\quad \int_0^{\infty}\dfrac{\Psi^2(x)}{x}\mathrm{d}x <\infty
$$


