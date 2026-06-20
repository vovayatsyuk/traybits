# Traybits

Bits of information fetched with javascript in the system tray.

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/screenshot-dark.webp" width="873">
    <img alt="Screenshot of the Traybits app" src="./media/screenshot-light.webp" width="876">
</picture>


## Developement

```
# run watcher
npm run tauri dev

# update icon
npm run tauri icon media/app-icon.png

# build binaries
npm run tauri build
```

## Bits examples

### Packagist download count

```js
export default async () => {
  const res = await fetch("https://packagist.org/packages/psr/log/stats.json");
  const data = await res.json();
  return new Intl.NumberFormat().format(data.downloads.total)
}
```

### GitHub stars and issues

<img alt="Screenshot of the GitHub stars" src="./media/screenshot-github.webp" width="241">

```js
export default async () => {
  const res = await fetch('https://api.github.com/repos/tauri-apps/tauri');
  const data = await res.json();
  return `★ ${new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(data.stargazers_count)} ⚠ ${data.open_issues_count}`;
}
```

### Football match score

<img alt="Screenshot of the football score" src="./media/screenshot-football.webp" width="202">

```js
const FIFA_TO_ISO = {
  NED: 'NL',
  SWE: 'SE',
  GER: 'DE',
  FRA: 'FR',
  ESP: 'ES',
  ENG: 'GB',
  USA: 'US',
  BRA: 'BR',
  ARG: 'AR',
};

function flag(abbr) {
  if (!FIFA_TO_ISO[abbr]) {
    return abbr;
  }
  return FIFA_TO_ISO[abbr].replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
}

export default async () => {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
  const data = await res.json();
  const game = data.events?.[0];

  if (!game) {
    return '⚽';
  }

  const [home, away] = game.competitions[0].competitors;

  return [
    flag(home.team.abbreviation),
    `${home.score}:${away.score}`,
    flag(away.team.abbreviation),
  ].join(' ');
}
```

### Days till New Year

```js
export default async () => {
  const now = new Date();
  const newYear = new Date(now.getFullYear() + 1, 0, 1);
  return '' + Math.ceil((newYear - now) / 86400000);
}
```
