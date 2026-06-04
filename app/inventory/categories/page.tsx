'use client'

import { useState, useEffect, useTransition } from 'react'
import { Plus, Pencil, Trash2, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  getCategoriesAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '@/lib/actions/categories'
import type { Category } from '@/lib/types'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [showCreate, setShowCreate] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    getCategoriesAction().then(data => {
      setCategories(data)
      setLoading(false)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('name', newName)

    startTransition(async () => {
      const result = await createCategoryAction(formData)
      if (result.success) {
        toast.success('Categoría creada')
        setNewName('')
        setShowCreate(false)
        const updated = await getCategoriesAction()
        setCategories(updated)
      } else {
        toast.error(result.error ?? 'Error al crear')
      }
    })
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCategory) return
    const formData = new FormData()
    formData.set('name', newName)

    startTransition(async () => {
      const result = await updateCategoryAction(editingCategory.id, formData)
      if (result.success) {
        toast.success('Categoría actualizada')
        setEditingCategory(null)
        setNewName('')
        const updated = await getCategoriesAction()
        setCategories(updated)
      } else {
        toast.error(result.error ?? 'Error al actualizar')
      }
    })
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar categoría "${name}"?`)) return
    setDeletingId(id)
    const result = await deleteCategoryAction(id)
    if (result.success) {
      toast.success('Categoría eliminada')
      setCategories(prev => prev.filter(c => c.id !== id))
    } else {
      toast.error(result.error ?? 'Error al eliminar')
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 text-sm mt-1">
            Organiza tus productos por categoría
          </p>
        </div>
        <Button onClick={() => { setNewName(''); setShowCreate(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : categories.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Tag size={14} className="text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">{cat.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setEditingCategory(cat)
                    setNewName(cat.name)
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  disabled={deletingId === cat.id}
                >
                  {deletingId === cat.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Tag size={36} className="text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">Sin categorías</h3>
          <p className="text-gray-400 text-sm mt-1 mb-4">
            Crea categorías para organizar tu inventario
          </p>
          <Button onClick={() => { setNewName(''); setShowCreate(true) }}>
            <Plus className="mr-2 h-4 w-4" /> Crear primera categoría
          </Button>
        </div>
      )}

      {/* Dialog: Crear / Editar */}
      <Dialog
        open={showCreate || !!editingCategory}
        onOpenChange={open => {
          if (!open) { setShowCreate(false); setEditingCategory(null) }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={editingCategory ? handleUpdate : handleCreate}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nombre *</Label>
                <Input
                  id="cat-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Ropa, Accesorios, Joyería..."
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowCreate(false); setEditingCategory(null) }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !newName.trim()}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCategory ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
