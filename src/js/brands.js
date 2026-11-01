// Brand marks for links. Glyphs live in img/brands/ (simple-icons, CC0) and are painted with a CSS mask so the
// colour follows the theme; sites with no glyph get a letter badge. No third-party requests (CSP is img-src 'self').
(function () {
  var BRANDS = {
    slack: '#E01E5A', googledrive: '#4285F4', buildkite: '#14CC80', gitlab: '#FC6D26', jira: '#2684FF',
    confluence: '#2684FF', atlassian: '#2684FF', '1password': '#3B82F6', citrix: '#8B5CF6', spotify: '#1ED760',
    messenger: '#0866FF', gmail: '#EA4335', google: '#4285F4', googlecalendar: '#4285F4', googledocs: '#4285F4',
    googlesheets: '#34A853', notion: '#E6E6E6', figma: '#F24E1E', linear: '#5E6AD2', datadog: '#8F5BD6',
    grafana: '#F46800', pagerduty: '#06AC38', docker: '#2496ED', terraform: '#844FBA', cloudflare: '#F38020',
    youtube: '#FF0000', reddit: '#FF4500', stackoverflow: '#F58025', sentry: '#8B7BC7', snyk: '#8A88C4',
    sonarqubeserver: '#126ED3', kubernetes: '#326CE5', ycombinator: '#F0652F', discord: '#5865F2',
    whatsapp: '#25D366', telegram: '#26A5E4', x: '#E6E6E6', npm: '#CB3837', go: '#00ADD8', zoom: '#0B5CFF',
    claude: '#D97757', anthropic: '#D97757'
  };
  // [hostname test, glyph]
  var HOSTS = [
    [/(^|\.)slack\.com$/, 'slack'], [/(^|\.)drive\.google\.com$/, 'googledrive'], [/(^|\.)buildkite\.com$/, 'buildkite'],
    [/(^|\.)gitlab\.com$/, 'gitlab'], [/(^|\.)atlassian\.net$/, null], [/(^|\.)atlassian\.com$/, 'atlassian'],
    [/(^|\.)1password\.com$/, '1password'], [/(^|\.)(citrix|cloud)\.com$/, 'citrix'], [/(^|\.)spotify\.com$/, 'spotify'],
    [/(^|\.)(messenger|facebook)\.com$/, 'messenger'], [/^mail\.google\.com$/, 'gmail'], [/^calendar\.google\.com$/, 'googlecalendar'],
    [/^docs\.google\.com$/, 'googledocs'], [/^sheets\.google\.com$/, 'googlesheets'], [/(^|\.)google\.com$/, 'google'],
    [/(^|\.)notion\.(so|com)$/, 'notion'], [/(^|\.)figma\.com$/, 'figma'], [/(^|\.)linear\.app$/, 'linear'],
    [/(^|\.)datadoghq\.(com|eu)$/, 'datadog'], [/(^|\.)grafana\.(com|net)$/, 'grafana'], [/(^|\.)pagerduty\.com$/, 'pagerduty'],
    [/(^|\.)docker\.com$/, 'docker'], [/(^|\.)terraform\.io$/, 'terraform'], [/(^|\.)cloudflare\.com$/, 'cloudflare'],
    [/(^|\.)youtube\.com$/, 'youtube'], [/(^|\.)reddit\.com$/, 'reddit'], [/(^|\.)stackoverflow\.com$/, 'stackoverflow'],
    [/(^|\.)sentry\.io$/, 'sentry'], [/(^|\.)snyk\.io$/, 'snyk'], [/(^|\.)kubernetes\.io$/, 'kubernetes'],
    [/(^|\.)news\.ycombinator\.com$/, 'ycombinator'], [/(^|\.)discord\.com$/, 'discord'], [/(^|\.)whatsapp\.com$/, 'whatsapp'],
    [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'], [/(^|\.)(x|twitter)\.com$/, 'x'], [/(^|\.)npmjs\.com$/, 'npm'],
    [/(^|\.)zoom\.us$/, 'zoom'], [/(^|\.)claude\.ai$/, 'claude'], [/(^|\.)anthropic\.com$/, 'anthropic']
  ];
  // Hostless matches by link name (e.g. an internal URL called "jira board"), checked after the hostname.
  var NAMES = [
    [/\bjira\b/i, 'jira'], [/\bconfluence\b/i, 'confluence'], [/\bbuildkite\b/i, 'buildkite'], [/\bslack\b/i, 'slack'],
    [/google ?drive/i, 'googledrive'], [/\b1password\b/i, '1password'], [/\bcitrix\b/i, 'citrix'], [/\bspotify\b/i, 'spotify'],
    [/\bmessenger\b/i, 'messenger'], [/\bgitlab\b/i, 'gitlab']
  ];
  var BADGE = { pocketsmith: '#5DB56B', aws: '#FF9900', outlook: '#4A9BE8', adfs: '#6FA8DC', concur: '#E8A33D' };
  var BADGE_NAMES = [[/pocket ?smith/i, 'pocketsmith'], [/\baws\b/i, 'aws'], [/\b(mail|outlook)\b/i, 'outlook'], [/\badfs\b/i, 'adfs'], [/\bconcur\b/i, 'concur']];
  var BADGE_HOSTS = [[/pocketsmith\.com$/, 'pocketsmith'], [/(^|\.)(aws\.amazon\.com|amazonaws\.com)$/, 'aws'], [/(^|\.)(outlook\.(office|live)\.com|office\.com)$/, 'outlook']];

  function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; } }
  function find(list, s) { for (var i = 0; i < list.length; i++) if (list[i][0].test(s)) return list[i][1]; return null; }

  // -> { glyph, colour } | { badge, colour, letter } | null
  function lookup(name, url) {
    var host = hostOf(url);
    var g = find(HOSTS, host) || find(NAMES, name || '');
    if (g && BRANDS[g]) return { glyph: g, colour: BRANDS[g] };
    var b = find(BADGE_HOSTS, host) || find(BADGE_NAMES, name || '');
    if (b) return { badge: b, colour: BADGE[b], letter: b === 'aws' ? 'aws' : b.charAt(0).toUpperCase() };
    var n = (name || host.replace(/^www\./, '')).trim();
    return { badge: 'generic', colour: null, letter: n ? n.charAt(0).toUpperCase() : '?' };
  }

  // Decorative element for a link; the link's own text stays the accessible name.
  window.SPBrand = function (name, url) {
    var b = lookup(name, url);
    var s = document.createElement('span');
    s.className = 'sp-brand';
    s.setAttribute('aria-hidden', 'true');
    if (b.colour) s.style.setProperty('--brand', b.colour);
    if (b.glyph) {
      s.classList.add('sp-brand-glyph');
      s.dataset.brand = b.glyph;
      var u = 'url("img/brands/' + b.glyph + '.svg")';
      s.style.maskImage = u;
      s.style.webkitMaskImage = u;
    } else {
      s.classList.add('sp-brand-badge');
      s.dataset.brand = b.badge;
      s.dataset.letter = b.letter;
    }
    return s;
  };
  window.SPBrand.lookup = lookup;
})();
