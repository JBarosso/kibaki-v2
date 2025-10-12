# Guide de Migration Tailwind vers SCSS/BEM

## Ce qui a été fait automatiquement

### Phase 1 - Structure SCSS (100% Terminé)
Tous les fichiers SCSS avec structures BEM vides ont été créés dans `src/styles/` :

**Layouts:**
- ✅ `layouts/_base-layout.scss`
- ✅ `layouts/_site-layout.scss`

**Composants:**
- ✅ `components/_site-nav.scss`
- ✅ `components/_app-header.scss`
- ✅ `components/_character-card.scss`
- ✅ `components/_duel-container.scss`
- ✅ `components/_modal.scss`
- ✅ `components/_language-switcher.scss`
- ✅ `components/_skeleton-card.scss`
- ✅ `components/_progress-bar.scss`
- ✅ `components/_transition-wrapper.scss`
- ✅ `components/_leaderboard-list.scss`
- ✅ `components/_leaderboard-row.scss`
- ✅ `components/_leaderboard-island.scss`
- ✅ `components/_tournament-bracket.scss`
- ✅ `components/_tournament-bracket-client.scss`
- ✅ `components/_tournaments-list-island.scss`
- ✅ `components/_submit-island.scss`
- ✅ `components/_tournament-new-island.scss`
- ✅ `components/_account-island.scss`
- ✅ `components/_forgot-island.scss`
- ✅ `components/_reset-password-island.scss`
- ✅ `components/_admin-submissions-island.scss`
- ✅ `components/_user-votes-island.scss`
- ✅ `components/_user-votes-list.scss`
- ✅ `components/_user-vote-item.scss`
- ✅ `components/_toast-provider.scss`

### Phase 2 - Remplacement classes (Partiellement terminé)

**Fichiers modifiés :**
- ✅ `src/layouts/Base.astro` - Classes BEM + import style.scss
- ✅ `src/layouts/SiteLayout.astro` - Classes BEM + import style.scss
- ✅ `src/components/SiteNav.astro` - Classes BEM complètes

### Phase 3 - Configuration (100% Terminé)
- ✅ `astro.config.mjs` - Tailwind retiré des integrations
- ✅ `src/styles/tailwind.css` - Supprimé
- ✅ `src/styles/style.scss` - Importe déjà tous les fichiers SCSS

---

## Ce qu'il reste à faire

### Composants React (.tsx) à migrer

Vous devez remplacer les classes Tailwind par BEM dans les fichiers suivants :

1. `src/components/AppHeader.tsx`
2. `src/components/CharacterCard.tsx`
3. `src/components/DuelContainer.tsx`
4. `src/components/Modal.tsx`
5. `src/components/LanguageSwitcher.tsx`
6. `src/components/SkeletonCard.tsx`
7. `src/components/ProgressBar.tsx`
8. `src/components/TransitionWrapper.tsx`
9. `src/components/LeaderboardList.tsx`
10. `src/components/LeaderboardRow.tsx`
11. `src/components/LeaderboardIsland.tsx`
12. `src/components/TournamentBracket.tsx`
13. `src/components/TournamentBracketClient.tsx`
14. `src/components/TournamentsListIsland.tsx`
15. `src/components/SubmitIsland.tsx`
16. `src/components/TournamentNewIsland.tsx`
17. `src/components/AccountIsland.tsx`
18. `src/components/ForgotIsland.tsx`
19. `src/components/ResetPasswordIsland.tsx`
20. `src/components/AdminSubmissionsIsland.tsx`
21. `src/components/UserVotesIsland.tsx`
22. `src/components/UserVotesList.tsx`
23. `src/components/UserVoteItem.tsx`
24. `src/components/ToastProvider.tsx`

---

## Méthode de migration (Patron à suivre)

### Exemple : Migration de AppHeader.tsx

**AVANT (Tailwind):**
```tsx
<header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
  <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
    <a href="/" className="font-semibold tracking-tight">Kibaki</a>
    <nav className="flex items-center gap-4 text-sm">
      <a href="/duel" className={linkCls(isActive('/duel'))}>{navLabels.duel}</a>
    </nav>
  </div>
</header>
```

**APRÈS (BEM):**
```tsx
<header className="app-header">
  <div className="app-header__container">
    <a href="/" className="app-header__logo">Kibaki</a>
    <nav className="app-header__nav">
      <a href="/duel" className={`app-header__link ${isActive('/duel') ? 'app-header__link--active' : ''}`}>
        {navLabels.duel}
      </a>
    </nav>
  </div>
</header>
```

### Règles de conversion Tailwind → BEM

1. **Conteneur principal** : Utilisez le nom du composant en kebab-case
   - `<div className="...">` → `<div className="component-name">`

2. **Éléments** : Utilisez `__element`
   - Sous-éléments logiques → `component-name__element`

3. **Modificateurs** : Utilisez `--modifier`
   - États dynamiques → `component-name__element--modifier`
   - Exemple : `--active`, `--disabled`, `--error`, `--success`

4. **Classes conditionnelles** :
   ```tsx
   // Avant
   className={`base ${isActive ? 'active-class' : 'inactive-class'}`}

   // Après
   className={`component__element ${isActive ? 'component__element--active' : ''}`}
   ```

5. **Classes multiples** :
   ```tsx
   // Avant
   className="flex items-center gap-4 text-sm hover:bg-gray-100"

   // Après
   className="component__nav"
   // Le CSS sera écrit dans le fichier SCSS correspondant
   ```

### Exemple complet : CharacterCard.tsx

**Structure BEM à utiliser:**
```tsx
<div className={`character-card ${className || ''}`}>
  <div className="character-card__image-wrapper">
    {image_url ? (
      <img src={image_url} alt={displayName} className="character-card__image" />
    ) : (
      <div className="character-card__image-placeholder" />
    )}
  </div>

  <div className="character-card__content">
    <div className="character-card__header">
      <h3 className="character-card__name" title={displayName}>{displayName}</h3>
      <div className="character-card__elo">
        ELO: <span className="character-card__elo-value">{elo}</span>
      </div>
    </div>

    <div className="character-card__stats">
      W-L: <span className="character-card__stats-value">{wins}</span>-
      <span className="character-card__stats-value">{losses}</span>
    </div>

    {displayDescription ? (
      <p className="character-card__description">{truncate(displayDescription, 120)}</p>
    ) : (
      <p className="character-card__description character-card__description--empty">
        {t('duel.noDescription')}
      </p>
    )}

    <div className="character-card__footer">
      <button type="button" onClick={onMore} className="character-card__more-button">
        {t('duel.more')}
      </button>
    </div>
  </div>
</div>
```

### Gestion des classes dynamiques

**Patron pour les boutons avec états:**
```tsx
// Avant (Tailwind)
<button
  className={`rounded-lg px-4 py-2 ${
    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900'
  } ${success ? 'bg-green-600' : 'bg-black'} text-white`}
>

// Après (BEM)
<button
  className={`component__button ${
    disabled ? 'component__button--disabled' : ''
  } ${success ? 'component__button--success' : ''}`}
>
```

### Classes composées avec fonctions

Si un composant utilise des fonctions pour générer des classes :

**Avant:**
```tsx
function linkCls(active: boolean) {
  return [
    'rounded px-2 py-1 hover:bg-gray-100 transition-colors',
    active ? 'text-gray-900 font-medium' : 'text-gray-600'
  ].join(' ');
}

<a className={linkCls(isActive('/duel'))} />
```

**Après:**
```tsx
function linkCls(active: boolean) {
  return `app-header__link ${active ? 'app-header__link--active' : ''}`;
}

<a className={linkCls(isActive('/duel'))} />
```

---

## Checklist de migration par composant

Pour chaque composant, suivez ces étapes :

1. ☐ Ouvrir le fichier .tsx
2. ☐ Identifier le nom du composant principal
3. ☐ Remplacer `className="..."` par la classe BEM principale
4. ☐ Pour chaque élément enfant, ajouter `__element`
5. ☐ Pour les états/modificateurs, ajouter `--modifier`
6. ☐ Chercher/remplacer toutes les classes Tailwind
7. ☐ Vérifier les classes conditionnelles
8. ☐ Tester visuellement le composant

---

## Ordre de migration recommandé

**Priorité 1 - Composants critiques (à faire en premier):**
1. AppHeader.tsx (navigation utilisée partout)
2. CharacterCard.tsx (utilisé dans duels et leaderboard)
3. Modal.tsx (réutilisé dans plusieurs composants)
4. ToastProvider.tsx (notifications globales)

**Priorité 2 - Pages principales:**
5. DuelContainer.tsx (page principale du site)
6. LeaderboardIsland.tsx, LeaderboardList.tsx, LeaderboardRow.tsx
7. AccountIsland.tsx (gestion compte)

**Priorité 3 - Fonctionnalités avancées:**
8. TournamentBracket.tsx, TournamentBracketClient.tsx
9. TournamentsListIsland.tsx, TournamentNewIsland.tsx
10. SubmitIsland.tsx

**Priorité 4 - Composants utilitaires:**
11. SkeletonCard.tsx, ProgressBar.tsx
12. TransitionWrapper.tsx, LanguageSwitcher.tsx
13. UserVotesIsland.tsx, UserVotesList.tsx, UserVoteItem.tsx

**Priorité 5 - Pages d'auth:**
14. ForgotIsland.tsx, ResetPasswordIsland.tsx
15. AdminSubmissionsIsland.tsx

---

## Points d'attention

### 1. Ne pas toucher à la logique JavaScript
- Gardez tous les `useState`, `useEffect`, `onClick` intacts
- Ne modifiez QUE les `className`

### 2. Préserver la structure HTML
- Ne changez pas l'ordre des éléments
- Ne supprimez/ajoutez pas d'éléments HTML
- Gardez la même hiérarchie

### 3. Classes conditionnelles
```tsx
// ✅ BON
className={`component__element ${condition ? 'component__element--modifier' : ''}`}

// ❌ MAUVAIS (ne pas mixer Tailwind et BEM)
className={`component__element ${condition ? 'bg-red-500' : ''}`}
```

### 4. Props className
Si un composant accepte une prop `className`, conservez-la :
```tsx
<div className={`component-name ${className || ''}`}>
```

---

## Tester après migration

Une fois tous les composants migrés :

1. **Vérifier visuellement** chaque page du site
2. **Tester les interactions** (hover, click, états)
3. **Vérifier la responsivité** sur mobile
4. **Contrôler la console** navigateur (pas d'erreurs)

---

## Ajouter le CSS dans les fichiers SCSS

**IMPORTANT:** Les fichiers SCSS créés contiennent UNIQUEMENT la structure BEM (accolades vides).

Une fois la migration des classes terminée, vous devrez :
1. Copier le CSS de Tailwind existant
2. Le traduire en propriétés CSS standards
3. L'ajouter dans les bons sélecteurs BEM

**Exemple pour `.app-header` :**
```scss
.app-header {
  border-bottom: 1px solid;
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);

  &__container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__logo {
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  &__nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.875rem;
  }

  &__link {
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    color: #4b5563;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f3f4f6;
    }

    &--active {
      color: #111827;
      font-weight: 500;
    }
  }
}
```

---

## Ressources

**Tailwind → CSS équivalences courantes:**
- `flex` → `display: flex;`
- `items-center` → `align-items: center;`
- `justify-between` → `justify-content: space-between;`
- `gap-4` → `gap: 1rem;`
- `px-4` → `padding-left: 1rem; padding-right: 1rem;`
- `py-2` → `padding-top: 0.5rem; padding-bottom: 0.5rem;`
- `text-sm` → `font-size: 0.875rem;`
- `rounded` → `border-radius: 0.375rem;`
- `bg-gray-100` → `background-color: #f3f4f6;`
- `text-gray-600` → `color: #4b5563;`

**Documentation BEM:**
- http://getbem.com/
- https://en.bem.info/methodology/

---

## Résumé

**Fichiers créés:** 27 fichiers SCSS avec structures BEM
**Fichiers modifiés:** 3 fichiers (Base.astro, SiteLayout.astro, SiteNav.astro)
**Configuration:** Tailwind retiré, style.scss configuré
**Reste à faire:** Migrer 24 composants React (.tsx)

**Temps estimé par composant:** 10-15 minutes
**Temps total estimé:** 4-6 heures de travail concentré

Bonne chance pour la migration ! 🚀
