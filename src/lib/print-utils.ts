/**
 * Utility for robust printing on Android devices.
 * Replaces simple window.onload with image-aware loading + safety timeout.
 */

/**
 * Returns the inline <script> block for print windows.
 * Waits for all images to load before printing, with a 3s safety fallback.
 */
export function getPrintScript(): string {
  return `
    <script>
      (function() {
        var printed = false;
        function doPrint() {
          if (printed) return;
          printed = true;
          window.print();
          window.onafterprint = function() { window.close(); };
        }
        var images = document.querySelectorAll('img');
        if (images.length === 0) {
          setTimeout(doPrint, 300);
        } else {
          var promises = Array.from(images).map(function(img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function(resolve) {
              img.onload = resolve;
              img.onerror = function() {
                img.style.display = 'none';
                resolve();
              };
            });
          });
          Promise.all(promises).then(function() {
            setTimeout(doPrint, 300);
          });
        }
        // Safety fallback - never hang
        setTimeout(doPrint, 3000);
      })();
    </script>
  `;
}

/**
 * Returns simplified CSS rules for Android print rendering.
 */
export function getAndroidPrintCSS(): string {
  return `
    @media print {
      * { box-shadow: none !important; border-radius: 0 !important; }
      body { overflow: visible !important; }
      img { max-width: 100% !important; }
    }
  `;
}

/**
 * Detects if the current device is Android.
 */
export function isAndroidDevice(): boolean {
  return /android/i.test(navigator.userAgent);
}
