import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Divider, 
  ListSubheader,
  Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import MicIcon from '@mui/icons-material/Mic';

const drawerWidth = 240;

export function SidebarLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
  ];

  const tunerItems = [
    { text: 'Tuner', icon: <MicIcon />, path: '/tuner' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            PitchQuest
          </Typography>
        </Box>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton 
                onClick={() => navigate(item.path)}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List
          subheader={
            <ListSubheader component="div" id="nested-list-subheader">
              Tuner
            </ListSubheader>
          }
        >
          {tunerItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton 
                onClick={() => navigate(item.path)}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, minHeight: '100vh', minWidth: 0 }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
