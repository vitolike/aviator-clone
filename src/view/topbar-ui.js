// HTML Topbar, Dropdown Menus, Rules Modal, and Avatar Selector logic
export function initTopbarUI({ game, sfx, scene, bots }) {
  // 1. Avatar state & persistence
  let currentAvatarId = parseInt(localStorage.getItem('aviator_user_avatar') || '1', 10);
  if (isNaN(currentAvatarId) || currentAvatarId < 1 || currentAvatarId > 72) {
    currentAvatarId = 1;
  }
  bots.userAvatarId = currentAvatarId;

  const dropdownAvatarImg = document.getElementById('dropdown_avatar_img');
  if (dropdownAvatarImg) {
    dropdownAvatarImg.src = `images/avtar/av-${currentAvatarId}.png`;
  }

  // 2. Populate 72 Avatars
  const avatarGrid = document.getElementById('avatar_grid');
  if (avatarGrid) {
    avatarGrid.innerHTML = '';
    for (let i = 1; i <= 72; i++) {
      const item = document.createElement('div');
      item.className = `avatar-item${i === currentAvatarId ? ' active' : ''}`;
      item.id = `avatar_choice_${i}`;
      item.innerHTML = `<img src="images/avtar/av-${i}.png" alt="Avatar ${i}" loading="lazy" />`;
      item.addEventListener('click', () => {
        selectAvatar(i);
      });
      avatarGrid.appendChild(item);
    }
  }

  function selectAvatar(id) {
    currentAvatarId = id;
    localStorage.setItem('aviator_user_avatar', String(id));
    bots.userAvatarId = id;

    if (dropdownAvatarImg) {
      dropdownAvatarImg.src = `images/avtar/av-${id}.png`;
    }

    // Update active highlight in grid
    document.querySelectorAll('.avatar-item').forEach((el, index) => {
      if (index + 1 === id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    closeAvatarModal();
    if (scene && scene.feed) {
      scene.feed.render();
    }
  }

  // 3. Balance Synchronization
  function updateBalance() {
    const formattedNum = game.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const numEl = document.getElementById('wallet_balance_num');
    const curEl = document.getElementById('wallet_balance_cur');
    if (numEl) numEl.textContent = formattedNum;
    if (curEl) curEl.textContent = 'USD';

    const el1 = document.getElementById('header_wallet_balance');
    const el2 = document.getElementById('wallet_balance');
    if (el1) el1.textContent = '$' + formattedNum;
    if (el2) el2.textContent = '$' + formattedNum;
    const name = document.getElementById('dropdown_user_email');
    if (name) name.textContent = game.username || 'Demo';
  }

  game.on('change', updateBalance);
  updateBalance();

  // 4. Dropdown Menu Toggle
  const menuToggleBtn = document.getElementById('menu_toggle_btn');
  const profileDropdown = document.getElementById('profile_dropdown');

  if (menuToggleBtn && profileDropdown) {
    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('show');
      sfx.click();
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target) && !menuToggleBtn.contains(e.target)) {
        profileDropdown.classList.remove('show');
      }
    });
  }

  // 5. Game Rules Modal
  const rulesModal = document.getElementById('game_rule_modal');
  const openRulesModal = () => {
    sfx.click();
    if (rulesModal) rulesModal.classList.add('show');
    if (profileDropdown) profileDropdown.classList.remove('show');
  };
  const closeRulesModal = () => {
    sfx.click();
    if (rulesModal) rulesModal.classList.remove('show');
  };

  document.getElementById('how_to_play_btn')?.addEventListener('click', openRulesModal);
  document.getElementById('menu_rules_link')?.addEventListener('click', openRulesModal);
  document.getElementById('menu_game_rules_link')?.addEventListener('click', openRulesModal);
  document.getElementById('close_rule_modal_btn')?.addEventListener('click', closeRulesModal);
  rulesModal?.addEventListener('click', (e) => {
    if (e.target === rulesModal) closeRulesModal();
  });

  // 6. Avatar Modal
  const avatarModal = document.getElementById('avatar_modal');
  const openAvatarModal = () => {
    sfx.click();
    if (avatarModal) avatarModal.classList.add('show');
    if (profileDropdown) profileDropdown.classList.remove('show');
  };
  const closeAvatarModal = () => {
    if (avatarModal) avatarModal.classList.remove('show');
  };

  document.getElementById('change_avatar_btn')?.addEventListener('click', openAvatarModal);
  document.getElementById('dropdown_avatar_img')?.addEventListener('click', openAvatarModal);
  document.getElementById('menu_avatar_link')?.addEventListener('click', openAvatarModal);
  document.getElementById('close_avatar_modal_btn')?.addEventListener('click', () => {
    sfx.click();
    closeAvatarModal();
  });
  avatarModal?.addEventListener('click', (e) => {
    if (e.target === avatarModal) closeAvatarModal();
  });

  // 7. Switches
  document.getElementById('sound_switch').checked = sfx.enabled;
  document.getElementById('music_switch').checked = sfx.musicEnabled;
  document.getElementById('animation_switch').checked = scene.settings.bgAnim;
  document.getElementById('sound_switch')?.addEventListener('change', (e) => {
    sfx.setEnabled(e.target.checked);
  });
  document.getElementById('music_switch')?.addEventListener('change', (e) => {
    sfx.setMusicEnabled(e.target.checked);
    if (e.target.checked && scene.engine.phase === 'flying') sfx.startEngine();
  });
  document.getElementById('animation_switch')?.addEventListener('change', (e) => {
    if (scene && scene.settings) {
      scene.settings.bgAnim = e.target.checked;
    }
  });

  // 8. Action Links
  const openGameModal = (kind) => {
    profileDropdown.classList.remove('show');
    scene.modal.open(kind, scene.ctx());
  };
  document.getElementById('menu_free_bets_link')?.addEventListener('click', (e) => { e.preventDefault(); openGameModal('freeBets'); });
  document.getElementById('menu_history_link')?.addEventListener('click', (e) => { e.preventDefault(); openGameModal('betHistory'); });
  document.getElementById('menu_limits_link')?.addEventListener('click', (e) => { e.preventDefault(); openGameModal('limits'); });
  document.getElementById('menu_home_link')?.addEventListener('click', (e) => { e.preventDefault(); profileDropdown.classList.remove('show'); });
  document.getElementById('menu_fair_link')?.addEventListener('click', () => {
    if (profileDropdown) profileDropdown.classList.remove('show');
    scene.modal.open('fair', scene.ctx());
  });

  const depositHandler = () => {
    sfx.bet();
    game.balance += 5000;
    game.save();
    updateBalance();
    if (profileDropdown) profileDropdown.classList.remove('show');
    scene.showToast('Deposited +$5,000.00 Demo Funds!');
  };

  document.getElementById('header_deposit_btn')?.addEventListener('click', depositHandler);
  document.getElementById('menu_deposit_link')?.addEventListener('click', depositHandler);

  document.getElementById('menu_reset_link')?.addEventListener('click', () => {
    sfx.click();
    game.balance = 30000;
    game.save();
    updateBalance();
    if (profileDropdown) profileDropdown.classList.remove('show');
    scene.showToast('Balance reset to $30,000.00');
  });

  // ESC key to close any open modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRulesModal();
      closeAvatarModal();
      if (profileDropdown) profileDropdown.classList.remove('show');
    }
  });
}
