---
layout: archive
title: "Gallery"
permalink: /gallery/
author_profile: true
---

{% include gallery %}

## Animations

Animations of GIC and Power Flow Work

### Electric Fields

<iframe 
  width="854" height="480" 
  src="https://www.youtube.com/embed/-QHlN1fslkw?controls=0&rel=0&loop=1&playlist=-QHlN1fslkw" 
  frameborder="0" 
  allow="autoplay; encrypted-media; picture-in-picture" 
  allowfullscreen>
</iframe>

<div id="player"></div>
<script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    var player;
    function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: '-QHlN1fslkw',
        playerVars: {
            modestbranding: 0,
            autoplay: 1,
            controls: 0,
            showinfo: 0,
            wmode: 'transparent',
            branding: 0,
            rel: 0,
            autohide: 0,
            origin: window.location.origin
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
        });
    }
    function onPlayerReady(event) {
        event.target.playVideo();
    }
    function onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) {
            player.playVideo(); 
        }
    }
</script>