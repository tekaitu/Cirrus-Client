# Cirrus Client 0.3.1 — review screenshots

Captured from a production build of the web frontend with the mocked desktop
commands from [`scripts/visual-check.mjs`](../../../scripts/visual-check.mjs):
the layout, branding, copy and account flow are real, while the Microsoft and
Mojang service responses are fixed fixtures. They are here so the pull request
can be reviewed without a Windows machine; the CI "Visual check" workflow
regenerates and publishes its own screenshot set on every push to this branch.

## Home

![Home with the transparent Cirrus mark](01-home.jpg)

## Account menu

![Account menu with the player's name and skin head](02-account-menu.jpg)

## Accounts page

![Accounts page with the signed-in profile and saved accounts](03-accounts.jpg)

## Skins page

![Skins page showing the account's own character](04-skins.jpg)

## Skins page — cape preview from behind

![Character turned to show the local Cirrus cape](05-skins-cape.jpg)

## Settings

![Settings without developer options](06-settings.jpg)

## Signed-out account panel

![Branded Microsoft and Minecraft sign-in](07-sign-in.jpg)
