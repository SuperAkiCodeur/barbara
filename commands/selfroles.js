const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'selfRoles.json');

function readData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  const dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selfroles')
    .setDescription('Gestion des self-roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajoute un rôle à la liste des self-roles')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Le rôle à ajouter')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('label')
            .setDescription('Texte affiché dans le menu')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description du rôle dans le menu')
            .setRequired(false)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retire un rôle de la liste des self-roles')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Le rôle à retirer')
            .setRequired(true)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Envoie le menu public de sélection des rôles')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Texte affiché au-dessus du menu')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('placeholder')
            .setDescription('Texte affiché dans le menu')
            .setRequired(false)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Affiche la liste des self-roles configurés')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const data = readData();
    const guildId = interaction.guild.id;

    if (!data[guildId]) {
      data[guildId] = [];
    }

    if (subcommand === 'add') {
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const description = interaction.options.getString('description') || '';

      if (role.managed) {
        return interaction.reply({
          content: 'Ce rôle est géré par une intégration et ne peut pas être utilisé.',
          ephemeral: true,
        });
      }

      const alreadyExists = data[guildId].some(r => r.id === role.id);

      if (alreadyExists) {
        return interaction.reply({
          content: 'Ce rôle est déjà dans la liste des self-roles.',
          ephemeral: true,
        });
      }

      data[guildId].push({
        id: role.id,
        label,
        description,
      });

      writeData(data);

      return interaction.reply({
        content: `Le rôle ${role} a été ajouté aux self-roles.`,
        ephemeral: true,
      });
    }

    if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      const before = data[guildId].length;

      data[guildId] = data[guildId].filter(r => r.id !== role.id);

      if (data[guildId].length === before) {
        return interaction.reply({
          content: 'Ce rôle n’était pas dans la liste des self-roles.',
          ephemeral: true,
        });
      }

      writeData(data);

      return interaction.reply({
        content: `Le rôle ${role} a été retiré des self-roles.`,
        ephemeral: true,
      });
    }

    if (subcommand === 'list') {
      if (data[guildId].length === 0) {
        return interaction.reply({
          content: 'Aucun self-role configuré sur ce serveur.',
          ephemeral: true,
        });
      }

      const content = data[guildId]
        .map(r => `- ${r.label} (<@&${r.id}>)`)
        .join('\n');

      return interaction.reply({
        content: `Self-roles configurés :\n${content}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'setup') {
      const guildRoles = data[guildId];

      if (guildRoles.length === 0) {
        return interaction.reply({
          content: 'Aucun rôle configuré. Ajoute d’abord des self-roles.',
          ephemeral: true,
        });
      }

      const customMessage =
        interaction.options.getString('message') ||
        'Choisissez vos rôles dans le menu ci-dessous :';

      const customPlaceholder =
        interaction.options.getString('placeholder') ||
        'Choisis tes rôles';

      const chunks = [];
      for (let i = 0; i < guildRoles.length; i += 25) {
        chunks.push(guildRoles.slice(i, i + 25));
      }

      const rows = chunks.map((chunk, index) => {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`self_roles_menu_${index}`)
          .setPlaceholder(customPlaceholder)
          .setMinValues(0)
          .setMaxValues(chunk.length)
          .addOptions(
            chunk.map(role => ({
              label: role.label || `Rôle ${role.id}`,
              value: role.id,
              description: role.description?.slice(0, 100) || undefined,
            }))
          );

        return new ActionRowBuilder().addComponents(menu);
      });

      await interaction.channel.send({
        content: customMessage,
        components: rows,
      });

      return interaction.reply({
        content: 'Le menu public des self-roles a été envoyé dans ce salon.',
        ephemeral: true,
      });
    }
  },
};