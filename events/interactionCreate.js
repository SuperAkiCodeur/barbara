const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

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
  },
};