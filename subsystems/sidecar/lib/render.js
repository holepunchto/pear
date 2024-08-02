'use strict'

module.exports = function render (opts = {}) {
  return `
  <html>
    <body>
      <style>${styles()}</style>
      <div id="view">
        <div id="panel">
          <div id="headline">${opts.headline}</div>
          <div id="message">${opts.message}</div>
          <div id="instruction">${opts.instruction}</div>
          <div class="cta-container">
            <button id="back" class="cta" onclick="back()" style="display: none;">Back</button>
            <button id="quit" class="cta" onclick="quit()">Quit</button>
          </div>
        </div>
      </div>
      <script>
        function back() { window.history.back() }
        function quit() { Pear.Window.self.close() }
        document.addEventListener('DOMContentLoaded', () => {
          if (window.history.length > 1) {
            document.getElementById('back').style.display = 'inline-block'
          }
        });
      </script>
    </body>
  </html>
`
}

const pearSvg = (opts = { w: 150, h: 190, f: '#1E1E1E' }) => {
  const { w, h, f } = opts
  return `
  <svg id="svg-pattern" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <symbol id="complex-shape" viewBox="0 0 45 45">
        <path d="M17.7632 2.75H19.3421V5.7125H17.7632V2.75Z" fill="${f}"/>
        <path d="M16.9737 6.65V7.25H15.3947V8H21.7105V7.25H20.1316V6.0875H18.5526V6.65H16.9737Z" fill="${f}"/>
        <path d="M23.2895 8.375H18.5526V8.9375H13.8158V10.2875H23.2895V8.375Z" fill="${f}"/>
        <path d="M24.8684 10.6625H18.5526V11.225H12.2368V12.575H24.8684V10.6625Z" fill="${f}"/>
        <path d="M24.8684 12.95H18.5526V13.5125H12.2368V14.8625H24.8684V12.95Z" fill="${f}"/>
        <path d="M26.4474 15.2375H18.5526V15.8H10.6579V17.15H26.4474V15.2375Z" fill="${f}"/>
        <path d="M26.4474 17.525H18.5526V18.0875H10.6579V19.4375H26.4474V17.525Z" fill="${f}"/>
        <path d="M28.0263 19.8125H18.5526V20.375H9.07895V21.725H28.0263V19.8125Z" fill="${f}"/>
        <path d="M29.6053 22.1H18.5526V22.6625H7.5V24.0125H29.6053V22.1Z" fill="${f}"/>
        <path d="M29.6053 24.3875H18.5526V24.95H7.5V26.3H29.6053V24.3875Z" fill="${f}"/>
        <path d="M29.6053 26.675H18.5526V27.2375H7.5V28.5875H29.6053V26.675Z" fill="${f}"/>
        <path d="M26.4474 28.9625H18.5526V29.525H10.6579V30.875H26.4474V28.9625Z" fill="${f}"/>
        <path d="M23.2895 31.25H18.5526V31.8125H13.8158V32.75H23.2895V31.25Z" fill="${f}"/>
      </symbol>
      <pattern id="pear-pattern" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
        <use href="#complex-shape" x="55" y="5" width="150" height="100"/>
        <use href="#complex-shape" x="-20" y="95" width="150" height="100"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#pear-pattern)"/>
  </svg>
  `
}

const styles = () => `
  #view {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 50px;
    height: calc(100vh - 60px);
    width: 100%;
    box-sizing: border-box;
    font-size: 16px;
    background-repeat: repeat;
    background-size: 150px 190px;
    background-image: url('data:image/svg+xml;base64,${Buffer.from(pearSvg()).toString('base64')}');
  }
  #panel {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
  }
  #instruction, #message {
    margin: 1em 0;
  }
  #headline {
    font-weight: 400;
    font-family: Inter, Helvetica, sans-serif;
    font-size: 2.50em;
    margin: 0.5em 0;
  }
  #message {
    font-weight: 600;
    font-family: Inter, Helvetica, sans-serif;
    font-size: 1.25em;
  }
  #instruction {
    font-family: Inter, Helvetica, sans-serif;
    font-size: 1em;
    font-weight: 400;
    color: #CED3DC;
  }
  .cta-container {
    display: flex;
    justify-content: center;
    gap: 1em;
    margin-top: 2em;
  }
  .cta {
    font-family: Inter, Helvetica, sans-serif;
    cursor: pointer;
    border-radius: 8px;
    width: 10em;
    height: 2.5em;
    box-sizing: border-box;
    display: inline-block;
    font-weight: 600;
    font-size: 1em;
    color: #151517;
    background: #B0D944;
    line-height: 0;
    border: none;
    outline: none;
  }
`
