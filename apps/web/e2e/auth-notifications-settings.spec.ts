import { test, expect } from '@playwright/test';
import { signInDemoSession } from './fixtures/test-api';

test.describe('Enterprise Auth, Profile, Settings & Administration Specs (v3)', () => {
  test('Login Page: Renders SGH Pro auth shell and validates @saudigerman.com input inline', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Work Email')).toBeVisible();
    const passwordInput = page.locator('#sgh-login-password');
    await expect(passwordInput).toBeVisible();

    await page.getByLabel('Work Email').fill('external@gmail.com');
    await passwordInput.fill('123');
    await page.getByRole('button', { name: /Sign in/i }).click();

    await expect(page.getByText(/Use your @saudigerman\.com email address/i)).toBeVisible();
    await expect(page.getByText(/Password must be at least 6 characters/i)).toBeVisible();
  });

  test('Settings Modal: Displays live System Health and persists compact density toggle', async ({
    page,
  }) => {
    await signInDemoSession(page);
    await page.goto('/');
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');

    const settingsBtn = page.getByRole('button', { name: 'System Settings' });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const dialog = page.locator('.settings-dialog-card');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('System & Workspace Settings')).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /System Health/i })).toBeVisible();

    await dialog.getByRole('tab', { name: /Display Preferences/i }).click();
    const densityToggle = dialog.getByLabel('Toggle compact density');
    await expect(densityToggle).toBeVisible();
    await densityToggle.click();

    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

    await dialog.getByRole('button', { name: /Done/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Profile Modal & Administration Roles Matrix: Inspects user profile and RBAC matrix', async ({
    page,
  }) => {
    await signInDemoSession(page);
    await page.goto('/');

    const profileBtn = page.locator('.topbar-profile-interactive');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();
    await page.getByRole('menuitem', { name: /My Profile & Password/i }).click();

    const profileDialog = page.locator('.profile-modal-card');
    await expect(profileDialog).toBeVisible();
    await expect(profileDialog.getByText('Saudi German Health')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(profileDialog).not.toBeVisible();

    await page.goto('/admin');
    const rolesTab = page.getByRole('tab', { name: /Roles & Permissions Matrix/i });
    await expect(rolesTab).toBeVisible();
    await rolesTab.click();
    await expect(page.getByText(/Roles & Permissions Matrix/i).first()).toBeVisible();
  });
});
