const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'selfRoles.json');

function readData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('self_roles_menu_')) return;

    const data = readData();
    const configuredRoles = data[interaction.guild.id] || [];
    const configuredRoleIds = configuredRoles.map(role => role.id);
    const selectedRoleIds = interaction.values;
    const member = interaction.member;

    const currentChunk = interaction.component.options.map(option => option.value);

    try {
      for (const roleId of currentChunk) {
        if (!configuredRoleIds.includes(roleId)) continue;

        if (selectedRoleIds.includes(roleId)) {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
          }
        } else {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
          }
        }
      }

      await interaction.reply({
        content: 'Tes rôles ont été mis à jour pour cette page du menu.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Erreur self roles dynamique :', error);
      await interaction.reply({
        content: 'Impossible de mettre à jour tes rôles.',
        ephemeral: true,
      });
    }
  },
};