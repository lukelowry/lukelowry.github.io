---
title: "sgwt - Python Module"
excerpt: "A power systems oriented Python module for the SGWT & sparse graph convolutions<br/><img src='/images/USA_Wavelet.png'>"
collection: resources
---

The GitHub repository for the `sgwt` package is available [here](https://github.com/lukelowry/sparse-sgwt).

I will soon upload a preprint for a TPEC paper that details the math used in the package.

Vector Fitting Functions
------

The table will eventually contain the poles and residues of various popular filters.

| Spectral Function   | Poles   | VF Data             |
| --------            | ------  | ------------------- | 
| Mexican Hat         | 2       | [Download]()        |
| Gaussian Wavelet    | 2       | [Download]()        |

Low-Pass Spectral Graph Filters
------

The proposed low-pass filter \eqref{eq:lowpass} is \textit{refinable}, as it is a self-similar rational function. The refinability of \eqref{eq:lowpass} makes it useful for signal smoothing across a range of spatial scales.

$$
\phi(\mathbf{\Lambda}) = \dfrac{I}{\mathbf{\Lambda}+I}
$$


This filter meets the admissibility criterion of a scaling kernel \eqref{eq:scaling-admiss} which is used in the SGWT \cite{sgwt-hammond}.

The voltage magnitude (scalar potential) must take this form (blue trace in Fig. \ref{fig:filters} and Fig. \ref{fig:log-filters}). This low-pass filter will be used to study the distribution of voltage magnitude in large systems.

High-Pass Spectral Graph Filters
------

The proposed high-pass filter \eqref{eq:highpass} acts as a container for variations over the graph below a given spatial scale.

$$
\mu(\mathbf{\Lambda}) = \dfrac{\mathbf{\Lambda}}{\mathbf{\Lambda}+I}
$$


We define the high-pass admissibility criterion \eqref{eq:sgwt-admiss} similarly to the constraints of the scaling functions 

$$
\mu(0)=0 \qquad\text{and}\quad \lim _{x\to\infty} \mu(x)=1
$$


A steady-state injected network current takes the form of a high-pass filter (red trace in Fig. \ref{fig:filters} and Fig. \ref{fig:log-filters}). This observation allows us to use the high-pass filters to study the current flows in the transmission network.

Band-Pass Spectral Graph Filters
------

A convenient closed-form wavelet generating kernel \eqref{eq:design-sgwt-kernel} was found to be a useful kernel as an alternative to the vector-fitting procedure if a particular filter does not need to be designed. Experiments have shown that \eqref{eq:design-sgwt-kernel} is sufficient for FOSL application.

$$
\Psi(\mathbf{\Lambda}) = \dfrac{4\mathbf{\Lambda}}{(\mathbf{\Lambda}+I)^2}
$$

This filter qualifies as a wavelet generating kernel for the SGWT, since $\Psi(0)=0$ and the admissibility condition is satisfied. The admissibility constant $C_f=8/3$ of this band-pass filter is detailed in Appendix \ref{app:admiss}.

$$
\Psi(0)=0  \qquad\text{and}\quad \int_0^{\infty}\dfrac{\Psi^2(x)}{x}\mathrm{d}x <\infty
$$

 Notice that the injected/emitted power from the network must take this form (gray trace in Fig. \ref{fig:filters} and Fig. \ref{fig:log-filters}). This observation prompts the use of band-pass filters to study the transmission of power in the graph spectral domain.

