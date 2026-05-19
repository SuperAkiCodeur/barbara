const { Events, MessageFlags } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`Commande introuvable : ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erreur sur la commande ${interaction.commandName}:`, error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Une erreur est survenue pendant l’exécution de la commande.',
          flags: MessageFlags.Ephemeral,
        }).catch(console.error);
      } else {
        await interaction.reply({
          content: 'Une erreur est survenue pendant l’exécution de la commande.',
          flags: MessageFlags.Ephemeral,
        }).catch(console.error);
      }
    }
  },
};