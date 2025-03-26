import { ipcMain } from 'electron';
import keytar from 'keytar';

ipcMain.handle('get-vercel-team-id', async () => {
  return await keytar.getPassword('pzdeploys', 'vercelTeamId');
});

ipcMain.handle('set-vercel-team-id', async (event, teamId: string) => {
  await keytar.setPassword('pzdeploys', 'vercelTeamId', teamId);
  return true;
}); 