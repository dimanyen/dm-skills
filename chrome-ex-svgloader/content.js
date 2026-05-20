(() => {
  let active = false;
  let banner = null;
  let lastHovered = null;

  function findSvgElement(el) {
    while (el) {
      if (el.tagName === 'svg' || el.tagName === 'SVG') return el;
      // Check if element is an <img> with SVG src
      if (el.tagName === 'IMG' && el.src && el.src.match(/\.svg(\?|$)/i)) return el;
      // Check <object> or <embed> with SVG
      if ((el.tagName === 'OBJECT' || el.tagName === 'EMBED') && el.data && el.data.match(/\.svg(\?|$)/i)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function getSvgDataUrl(svgEl) {
    return new Promise((resolve) => {
      if (svgEl.tagName === 'IMG' || svgEl.tagName === 'OBJECT' || svgEl.tagName === 'EMBED') {
        const src = svgEl.src || svgEl.data;
        // Fetch the SVG source to get its content
        fetch(src)
          .then((r) => r.text())
          .then((text) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svg = doc.querySelector('svg');
            if (svg) {
              resolve(prepareSvg(svg));
            } else {
              // Fallback: use the URL directly
              resolve({ dataUrl: src, width: svgEl.width || 200, height: svgEl.height || 200 });
            }
          })
          .catch(() => {
            resolve({ dataUrl: src, width: svgEl.width || 200, height: svgEl.height || 200 });
          });
        return;
      }
      resolve(prepareSvg(svgEl));
    });
  }

  function prepareSvg(svgEl) {
    const clone = svgEl.cloneNode(true);

    // Remove highlight class from clone
    clone.classList.remove('svg-dl-highlight');

    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }

    // Determine dimensions
    const bbox = svgEl.getBoundingClientRect();
    let width = parseFloat(clone.getAttribute('width')) || bbox.width || 200;
    let height = parseFloat(clone.getAttribute('height')) || bbox.height || 200;

    // Ensure the clone has explicit width/height for canvas rendering
    if (!clone.getAttribute('width')) clone.setAttribute('width', width);
    if (!clone.getAttribute('height')) clone.setAttribute('height', height);

    const svgContent = new XMLSerializer().serializeToString(clone);
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);

    return { dataUrl, width, height };
  }

  function downloadAsPng(svgEl) {
    const scale = 2; // 2x for retina quality
    const filename = (
      svgEl.id ||
      svgEl.getAttribute('aria-label') ||
      (svgEl.src || svgEl.data || '').split('/').pop().split('?')[0].replace(/\.svg$/i, '') ||
      'download'
    ).replace(/[^a-zA-Z0-9._-]/g, '_') + '.png';

    getSvgDataUrl(svgEl).then(({ dataUrl, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.onerror = () => {
        // Fallback: download as SVG if PNG conversion fails
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename.replace(/\.png$/, '.svg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      img.src = dataUrl;
    });
  }

  function onMouseOver(e) {
    const svg = findSvgElement(e.target);
    if (svg && svg !== lastHovered) {
      if (lastHovered) lastHovered.classList.remove('svg-dl-highlight');
      svg.classList.add('svg-dl-highlight');
      lastHovered = svg;
    }
  }

  function onMouseOut(e) {
    const svg = findSvgElement(e.target);
    if (svg) {
      svg.classList.remove('svg-dl-highlight');
      if (lastHovered === svg) lastHovered = null;
    }
  }

  function onClick(e) {
    const svg = findSvgElement(e.target);
    if (svg) {
      e.preventDefault();
      e.stopPropagation();
      downloadAsPng(svg);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      deactivate();
    }
  }

  function activate() {
    if (active) return;
    active = true;

    banner = document.createElement('div');
    banner.className = 'svg-dl-banner';
    banner.innerHTML = 'SVG Selection Mode<span>Click any SVG to download as PNG &middot; Press Esc to exit</span>';
    document.body.appendChild(banner);

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function deactivate() {
    if (!active) return;
    active = false;

    if (lastHovered) {
      lastHovered.classList.remove('svg-dl-highlight');
      lastHovered = null;
    }
    if (banner) {
      banner.remove();
      banner = null;
    }

    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggleSvgMode') {
      if (active) {
        deactivate();
      } else {
        activate();
      }
    }
  });
})();
