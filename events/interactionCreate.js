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
  async execute(interaction, client) {
    console.log('Interaction reçue');

    if (interaction.isChatInputCommand()) {
      console.log('Slash command reçue :', interaction.commandName);

      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Commande introuvable : ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Erreur commande slash :', error);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'Erreur lors de l’exécution de la commande.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: 'Erreur lors de l’exécution de la commande.',
            ephemeral: true,
          });
        }
      }

      return;
    }

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

        const hasRole = member.roles.cache.has(roleId);
        const shouldHaveRole = selectedRoleIds.includes(roleId);

        if (shouldHaveRole && !hasRole) {
          await member.roles.add(roleId);
        }

        if (!shouldHaveRole && hasRole) {
          await member.roles.remove(roleId);
        }
      }

      await interaction.reply({
        content: 'Tes rôles ont été mis à jour pour cette page du menu.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Erreur self roles dynamique :', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Impossible de mettre à jour tes rôles.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'Impossible de mettre à jour tes rôles.',
          ephemeral: true,
        });
      }
    }
  },
};