const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'selfRoles.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Configurer les rôles auto-attribuables')
    .addStringOption(option =>
      option
        .setName('roles')
        .setDescription('Mentionne les rôles à proposer')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    console.log('setuproles exécuté');
    const input = interaction.options.getString('roles', true);
    const matches = [...input.matchAll(/<@&(\d+)>/g)];
    const roleIds = [...new Set(matches.map(match => match[1]))];

    if (roleIds.length === 0) {
      return interaction.reply({
        content: 'Aucun rôle détecté. Mentionne les rôles comme ceci : @Minecraft @JV @Musique',
        ephemeral: true,
      });
    }

    const roles = roleIds
      .map(roleId => interaction.guild.roles.cache.get(roleId))
      .filter(Boolean)
      .map(role => ({
        id: role.id,
        name: role.name,
      }));

    if (roles.length === 0) {
      return interaction.reply({
        content: 'Les rôles mentionnés sont introuvables sur ce serveur.',
        ephemeral: true,
      });
    }

    const data = readData();
    data[interaction.guild.id] = roles;
    writeData(data);

    await interaction.reply({
      content: `Configuration enregistrée avec ${roles.length} rôle(s) : ${roles.map(role => role.name).join(', ')}`,
      ephemeral: true,
    });
  },
};