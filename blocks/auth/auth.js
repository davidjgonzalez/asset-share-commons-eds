/** @owner user */
/**
 * auth — a sign-in / sign-out widget. Reflects the active auth strategy
 * (configurations.users.strategy): shows a "Sign in" button when signed out, or
 * the current user + "Sign out" when signed in. A no-op display under the
 * `anonymous` strategy (renders nothing), so it is safe to place in the header
 * of any site whether or not auth is configured.
 *
 * Authoring (da.live): place the block with no rows, or one optional row to
 * override the signed-out label:
 *
 *   | auth      |          |
 *   | label     | Sign in  |
 *
 * All auth behavior lives in the strategy; this block only calls
 * users.login() / users.logout() / users.getProfile().
 */
import services from '../../scripts/asc/core/services/services.js';
import { readBlockConfig } from '../../scripts/asc/core/utils/blocks.js';

export default async function decorate(block) {
  const { label = 'Sign in' } = readBlockConfig(block);
  const { users } = services;
  block.textContent = '';

  // anonymous strategy → nothing to show.
  if (users.strategyId === 'anonymous') {
    block.hidden = true;
    return;
  }

  // Session state is resolved asynchronously (AEM probe / SDK). Wait for it.
  await users.ready();

  if (users.isSignedIn()) {
    const profile = await users.getProfile();
    const name = profile.displayName || profile.email || profile.userId;

    const who = document.createElement('span');
    who.className = 'auth__user';
    who.innerHTML = `<span class="auth__name"></span>`;
    who.querySelector('.auth__name').textContent = name;

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'btn btn--secondary auth__signout';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => users.logout());

    block.append(who, signOut);
  } else {
    const signIn = document.createElement('button');
    signIn.type = 'button';
    signIn.className = 'btn btn--primary auth__signin';
    signIn.textContent = label;
    signIn.addEventListener('click', () => users.login());

    block.append(signIn);
  }
}
