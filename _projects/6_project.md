---
layout: page
title: SpectralGraphWavelet.jl
description: A Julia package for Online GSP Convolutions over Dynamic Graphs
img: /assets/img/USA_Wavelet_julia.png
importance: 1
category: work
---

A registered package on the Julia Registry and availalbe on [GitHub](https://github.com/lukelowry/SpectralGraphWavelet.jl), free to use to accelerate your research.

Example of the bandpass convolution (which can be used as a fast reusable and graph independent SGWT operator)

```julia
function bandpass(conv::DyConvolve, B)
    W = typeof(B)[]
    
    # Pre-allocate buffers
    X1 = similar(B)
    X2 = similar(B)
    
    for (i, q) in enumerate(conv.poles)
        F = conv.factors[i]
        
        # Step 1: X2 = F \ B
        ldiv!(X2, F, B)
        
        # Step 2: X1 = F \ X2
        ldiv!(X1, F, X2)
        
        # Step 3: X2 = L * X1
        mul!(X2, conv.L, X1)
        
        # Scale
        X2 .*= (4.0 * q)
        push!(W, copy(X2))
    end

    return W
end
```

This package uses the native sparse tools available in Julia. It is a sister package to the Python module `sgwt`, which has slightly better performance.