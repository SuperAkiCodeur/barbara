const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    console.log('Interaction reçue');

    if (!interaction.isChatInputCommand()) return;

    console.log('Commande :', interaction.commandName);

    if (interaction.commandName === 'setuproles') {
      await interaction.reply({
        content: 'La commande setuproles est bien reçue.',
        ephemeral: true,
      });
    }
  },
};