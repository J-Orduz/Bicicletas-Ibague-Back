/**
 * Clase base para implementar el patrón Singleton
 * Garantiza que solo exista una instancia de la clase
 */
export class BaseSingleton {
  constructor() {
    // Prevenir instanciación directa si ya existe una instancia
    if (this.constructor.instance) {
      return this.constructor.instance;
    }
    
    // Guardar referencia a la instancia
    this.constructor.instance = this;
  }

  /**
   * Método estático para obtener la instancia única
   * @returns {BaseSingleton} La instancia única de la clase
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Método para resetear la instancia (útil para testing)
   */
  static resetInstance() {
    this.instance = null;
  }
}

