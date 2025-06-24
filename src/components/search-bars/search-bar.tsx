import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/buttons/button'
import { Search } from 'lucide-react'

const SearchBar = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 relative">
        <Input
          type="text"
          placeholder="Search for organisms..."
          className="pl-10 pr-16"
        />
        <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <Button
          variant="ghost"
          className="absolute right-6 top-1/2 transform -translate-y-1/2"
        >
          ADV.
        </Button>
      </div>
  )
}

export default SearchBar;