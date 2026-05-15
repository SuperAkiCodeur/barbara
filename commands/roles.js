const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'selfRoles.json');

function readData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Choisir ses rôles'),

  async execute(interaction) {
    const data = readData();
    const configuredRoles = data[interaction.guild.id] || [];

    const roles = configuredRoles.filter(role =>
      interaction.guild.roles.cache.has(role.id)
    );

    if (roles.length === 0) {
      return interaction.reply({
        content: 'Aucun rôle auto-attribuable n’a été configuré.',
        ephemeral: true,
      });
    }

    const memberRoleIds = interaction.member.roles.cache.map(role => role.id);
    const roleChunks = chunkArray(roles, 25);

    if (roleChunks.length > 5) {
      return interaction.reply({
        content: 'Il y a trop de rôles configurés pour être affichés dans un seul message.',
        ephemeral: true,
      });
    }

    const rows = roleChunks.map((chunk, index) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`self_roles_menu_${index}`)
        .setPlaceholder(`Choisis tes rôles (${index + 1}/${roleChunks.length})`)
        .setMinValues(0)
        .setMaxValues(chunk.length)
        .addOptions(
          chunk.map(role => ({
            label: role.name.slice(0, 100),
            value: role.id,
            default: memberRoleIds.includes(role.id),
          }))
        );

      return new ActionRowBuilder().addComponents(menu);
    });

    await interaction.reply({
      content: 'Sélectionne les rôles que tu veux garder.',
      components: rows,
      ephemeral: true,
    });
  },
};