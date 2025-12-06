//Observer Interface (Patrón Observer)
export class Observer {
  // Método que se llama cuando se publica un evento
  async update(event, channel) {
    throw new Error('update() debe ser implementado por la subclase');
  }

  // Identificador único del observador
  getId() {
    throw new Error('getId() debe ser implementado por la subclase');
  }
}

export class CallbackObserver extends Observer {
  constructor(id, callback) {
    super();
    this.id = id;
    this.callback = callback;
  }

  async update(event, channel) {
    return await this.callback(event);
  }

  getId() {
    return this.id;
  }
}

