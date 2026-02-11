use std::io::{self, BufReader, BufWriter, Read, Write};

pub struct Elevator {
    id: u32,
    current_floor_val: i32,
    destination_floor_val: Option<i32>,
    percent_full_val: f32,
    pressed_buttons: Vec<i32>,
    commands: Vec<(u32, i32)>,
}

impl Elevator {
    pub fn current_floor(&self) -> i32 {
        self.current_floor_val
    }

    pub fn destination_floor(&self) -> Option<i32> {
        self.destination_floor_val
    }

    pub fn percent_full(&self) -> f32 {
        self.percent_full_val
    }

    pub fn pressed_floor_buttons(&self) -> &[i32] {
        &self.pressed_buttons
    }

    pub fn go_to_floor(&mut self, floor: i32) {
        self.commands.push((self.id, floor));
    }
}

pub struct Floor {
    level_val: i32,
    up: bool,
    down: bool,
}

impl Floor {
    pub fn level(&self) -> i32 {
        self.level_val
    }

    pub fn button_up(&self) -> bool {
        self.up
    }

    pub fn button_down(&self) -> bool {
        self.down
    }
}

fn read_state(reader: &mut BufReader<io::StdinLock>) -> io::Result<(Vec<Elevator>, Vec<Floor>)> {
    let mut buf4 = [0u8; 4];

    reader.read_exact(&mut buf4)?;
    let elevator_count = u32::from_le_bytes(buf4) as usize;

    reader.read_exact(&mut buf4)?;
    let floor_count = u32::from_le_bytes(buf4) as usize;

    let mut elevators = Vec::with_capacity(elevator_count);
    for id in 0..elevator_count {
        reader.read_exact(&mut buf4)?;
        let current_floor = i32::from_le_bytes(buf4);

        reader.read_exact(&mut buf4)?;
        let dest_raw = i32::from_le_bytes(buf4);
        let destination_floor = if dest_raw == -1 { None } else { Some(dest_raw) };

        reader.read_exact(&mut buf4)?;
        let percent_full = f32::from_le_bytes(buf4);

        reader.read_exact(&mut buf4)?;
        let button_count = u32::from_le_bytes(buf4) as usize;

        let mut pressed_buttons = Vec::with_capacity(button_count);
        for _ in 0..button_count {
            reader.read_exact(&mut buf4)?;
            pressed_buttons.push(i32::from_le_bytes(buf4));
        }

        elevators.push(Elevator {
            id: id as u32,
            current_floor_val: current_floor,
            destination_floor_val: destination_floor,
            percent_full_val: percent_full,
            pressed_buttons,
            commands: Vec::new(),
        });
    }

    let mut floors = Vec::with_capacity(floor_count);
    for _ in 0..floor_count {
        reader.read_exact(&mut buf4)?;
        let level = i32::from_le_bytes(buf4);

        let mut buf1 = [0u8; 1];
        reader.read_exact(&mut buf1)?;
        let up = buf1[0] != 0;

        reader.read_exact(&mut buf1)?;
        let down = buf1[0] != 0;

        floors.push(Floor {
            level_val: level,
            up,
            down,
        });
    }

    Ok((elevators, floors))
}

fn write_commands(writer: &mut BufWriter<io::StdoutLock>, commands: &[(u32, i32)]) -> io::Result<()> {
    writer.write_all(&(commands.len() as u32).to_le_bytes())?;
    for &(elevator_id, target_floor) in commands {
        writer.write_all(&elevator_id.to_le_bytes())?;
        writer.write_all(&target_floor.to_le_bytes())?;
    }
    writer.flush()
}

pub fn run<F: FnMut(&mut [Elevator], &[Floor])>(mut tick: F) {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut writer = BufWriter::new(stdout.lock());

    loop {
        let (mut elevators, floors) = match read_state(&mut reader) {
            Ok(state) => state,
            Err(_) => break,
        };

        tick(&mut elevators, &floors);

        let commands: Vec<(u32, i32)> = elevators
            .iter_mut()
            .flat_map(|e| e.commands.drain(..))
            .collect();

        if write_commands(&mut writer, &commands).is_err() {
            break;
        }
    }
}
